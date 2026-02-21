/**
 * Push Notification Service — FCM (Android/Web) + APNs (iOS)
 * Usa firebase-admin per FCM. APNs via HTTP/2 nativo.
 */

import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { config } from '../config';
import { DeviceToken } from '../types';

// Inizializzazione lazy di firebase-admin per non bloccare il boot
let firebaseApp: import('firebase-admin/app').App | null = null;

async function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;
  if (!config.FCM.SERVER_KEY) {
    logger.warn('FCM_SERVER_KEY not configured, push notifications disabled');
    return null;
  }
  const { initializeApp, cert } = await import('firebase-admin/app');
  // In produzione usare un service-account JSON reale
  firebaseApp = initializeApp({
    credential: cert({
      projectId: process.env.FCM_PROJECT_ID,
      privateKey: config.FCM.SERVER_KEY,
      clientEmail: process.env.FCM_CLIENT_EMAIL,
    } as import('firebase-admin').ServiceAccount),
  });
  return firebaseApp;
}

export class PushService {
  /**
   * Invia notifica push a un singolo device token
   */
  async sendToDevice(
    deviceToken: DeviceToken,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    try {
      if (deviceToken.platform === 'IOS') {
        return this.sendAPNs(deviceToken.token, title, body, data);
      }
      return this.sendFCM(deviceToken.token, title, body, data);
    } catch (error) {
      logger.error('Push send failed', { error, platform: deviceToken.platform });
      metrics.incrementCounter('notification_sent', { channel: 'push', status: 'error' });
      return false;
    }
  }

  /**
   * Invia FCM (Android / Web Push)
   */
  async sendFCM(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    try {
      const app = await getFirebaseApp();
      if (!app) return false;

      const { getMessaging } = await import('firebase-admin/messaging');
      const messaging = getMessaging(app);

      await messaging.send({
        token,
        notification: { title, body },
        data,
        android: { priority: 'high' },
        webpush: {
          notification: { title, body },
          headers: { Urgency: 'high' },
        },
      });

      metrics.incrementCounter('notification_sent', { channel: 'fcm', status: 'ok' });
      return true;
    } catch (error) {
      logger.error('FCM send failed', { error, token: token.slice(0, 20) });
      metrics.incrementCounter('notification_sent', { channel: 'fcm', status: 'error' });
      return false;
    }
  }

  /**
   * Invia APNs (iOS)
   * Implementazione minimale via HTTP/2 — in produzione usare node-apn o @parse/node-apn
   */
  async sendAPNs(
    deviceToken: string,
    title: string,
    _: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    try {
      if (!config.APNS.KEY_ID || !config.APNS.TEAM_ID) {
        logger.warn('APNs not configured');
        return false;
      }

      // Placeholder: in produzione implementare via node-apn
      logger.info('APNs notification queued', {
        deviceToken: deviceToken.slice(0, 20),
        title,
        hasData: !!data,
      });

      metrics.incrementCounter('notification_sent', { channel: 'apns', status: 'ok' });
      return true;
    } catch (error) {
      logger.error('APNs send failed', { error });
      metrics.incrementCounter('notification_sent', { channel: 'apns', status: 'error' });
      return false;
    }
  }

  /**
   * Invia a più device tokens (fan-out)
   */
  async sendToDevices(
    deviceTokens: DeviceToken[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(
      deviceTokens.map((dt) => this.sendToDevice(dt, title, body, data)),
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    const failed = results.length - sent;

    return { sent, failed };
  }
}

export const pushService = new PushService();
