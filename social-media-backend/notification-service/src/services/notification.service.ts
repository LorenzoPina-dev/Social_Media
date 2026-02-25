/**
 * Notification Service — Business Logic Core
 *
 * Orchestrazione di:
 *   1. Controllo preferenze utente
 *   2. Persistenza DB
 *   3. Push WebSocket (real-time in-app)
 *   4. Push Notification (FCM/APNs)
 *   5. Email
 *   6. Cache Redis (contatore non lette)
 */

import { NotificationModel } from '../models/notification.model';
import { PreferencesModel } from '../models/preferences.model';
import { DeviceTokenModel } from '../models/deviceToken.model';
import { websocketService } from './websocket.service';
import { pushService } from './push.service';
import { emailService } from './email.service';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { config } from '../config';
import {
  Notification,
  EntityType,
  NotificationPreferences,
} from '../types';
import { NotificationType } from '@social-media/shared';

interface NotificationInput {
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  entityId?: string;
  entityType?: EntityType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** email del destinatario (per invio email) */
  recipientEmail?: string;
}

export class NotificationService {
  constructor(
    private readonly notificationModel: NotificationModel,
    private readonly preferencesModel: PreferencesModel,
    private readonly deviceTokenModel: DeviceTokenModel,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // CREAZIONE E DISPATCH
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Crea e invia una notifica con tutti i canali abilitati
   */
  async notify(input: NotificationInput): Promise<Notification | null> {
    // Non notificare se il destinatario è anche l'attore (self-action)
    if (input.actorId && input.actorId === input.recipientId) {
      logger.debug('Skipping self-notification', { userId: input.recipientId, type: input.type });
      return null;
    }

    // Deduplicazione: evita doppie notifiche per lo stesso evento
    if (input.actorId && input.entityId) {
      const duplicate = await this.notificationModel.findDuplicate(
        input.recipientId,
        input.actorId,
        input.type,
        input.entityId,
      );
      if (duplicate) {
        logger.debug('Duplicate notification skipped', { type: input.type, recipientId: input.recipientId });
        return duplicate;
      }
    }

    // Recupera preferenze
    const prefs = await this.preferencesModel.findByUserId(input.recipientId);

    // Controlla quiet hours
    if (prefs && this.isQuietHours(prefs)) {
      logger.debug('Quiet hours active, skipping push/email', { userId: input.recipientId });
      // Salva comunque la notifica in-app
    }

    // Salva in DB
    const notification = await this.notificationModel.create({
      recipient_id: input.recipientId,
      actor_id: input.actorId,
      type: input.type,
      entity_id: input.entityId,
      entity_type: input.entityType,
      title: input.title,
      body: input.body,
    });

    metrics.incrementCounter('notification_created', { type: input.type });

    // Aggiorna contatore non lette in Redis
    await this.incrementUnreadCount(input.recipientId);

    // Dispatch in-app via WebSocket
    const delivered = await websocketService.emitToUser(input.recipientId, 'notification:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      read: false,
      user_id: input.recipientId,
      updated_at: notification.created_at,
      entity_id: notification.entity_id,
      entity_type: notification.entity_type,
      data: input.data,
      created_at: notification.created_at,
    });

    if (delivered) {
      metrics.incrementCounter('notification_sent', { channel: 'websocket', status: 'ok' });
    }

    // Se quiet hours attive, salta push e email
    if (prefs && this.isQuietHours(prefs)) {
      return notification;
    }

    // Push notification
    if (this.isPushEnabled(prefs, input.type)) {
      await this.sendPushNotification(input.recipientId, input.title, input.body);
    }

    // Email notification
    if (this.isEmailEnabled(prefs, input.type) && input.recipientEmail) {
      await emailService.send(input.recipientEmail, input.title, `<p>${input.body}</p>`);
    }

    return notification;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RECUPERO
  // ──────────────────────────────────────────────────────────────────────────

  async getNotifications(
    userId: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<{ notifications: Notification[]; hasMore: boolean; nextCursor?: string }> {
    const notifications = await this.notificationModel.findByRecipient(userId, limit + 1, cursor);
    const hasMore = notifications.length > limit;
    if (hasMore) notifications.pop();

    const nextCursor =
      hasMore && notifications.length > 0
        ? Buffer.from(notifications[notifications.length - 1].created_at.toISOString()).toString('base64')
        : undefined;

    return { notifications, hasMore, nextCursor };
  }

  async getUnreadCount(userId: string): Promise<number> {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(`notifications:unread:${userId}`);
      if (cached !== null) return parseInt(cached, 10);

      const count = await this.notificationModel.countUnread(userId);
      await redis.setex(`notifications:unread:${userId}`, config.CACHE.UNREAD_COUNT_TTL, count.toString());
      return count;
    } catch {
      return this.notificationModel.countUnread(userId);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AZIONI UTENTE
  // ──────────────────────────────────────────────────────────────────────────

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const updated = await this.notificationModel.markAsRead(notificationId, userId);
    if (updated) {
      await this.decrementUnreadCount(userId);
      await websocketService.emitToUser(userId, 'notification:read', { id: notificationId });
    }
    return updated;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const count = await this.notificationModel.markAllAsRead(userId);
    if (count > 0) {
      await this.resetUnreadCount(userId);
      await websocketService.emitToUser(userId, 'notifications:all_read', {});
    }
    return count;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GDPR: cancellazione dati utente
  // ──────────────────────────────────────────────────────────────────────────

  async deleteUserData(userId: string): Promise<void> {
    await Promise.allSettled([
      this.notificationModel.deleteByRecipient(userId),
      this.deviceTokenModel.deleteByUserId(userId),
      this.preferencesModel.deleteByUserId(userId),
      this.resetUnreadCount(userId),
    ]);
    logger.info('GDPR: user notification data deleted', { userId });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HELPERS PRIVATI
  // ──────────────────────────────────────────────────────────────────────────

  private async sendPushNotification(userId: string, title: string, body: string): Promise<void> {
    try {
      const deviceTokens = await this.deviceTokenModel.findByUserId(userId);
      if (deviceTokens.length === 0) return;
      await pushService.sendToDevices(deviceTokens, title, body);
    } catch (error) {
      logger.error('Push notification failed', { userId, error });
    }
  }

  private isPushEnabled(prefs: NotificationPreferences | undefined, type: NotificationType): boolean {
    if (!prefs) return true; // default: push abilitato
    switch (type) {
      case 'like': return prefs.likes_push;
      case 'comment': return prefs.comments_push;
      case 'follow': return prefs.follows_push;
      case 'mention': return prefs.mentions_push;
      case 'share': return prefs.likes_push; // reutilizza flag like
      default: return true;
    }
  }

  private isEmailEnabled(prefs: NotificationPreferences | undefined, type: NotificationType): boolean {
    if (!prefs) return false; // default: email disabilitata
    switch (type) {
      case 'like': return prefs.likes_email;
      case 'comment': return prefs.comments_email;
      case 'follow': return prefs.follows_email;
      case 'mention': return prefs.mentions_email;
      default: return false;
    }
  }

  private isQuietHours(prefs: NotificationPreferences): boolean {
    if (!prefs.quiet_hours_start || !prefs.quiet_hours_end) return false;

    const now = new Date();
    const [startH, startM] = prefs.quiet_hours_start.split(':').map(Number);
    const [endH, endM] = prefs.quiet_hours_end.split(':').map(Number);

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    }
    // Overnight: es. 22:00 → 08:00
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }

  private async incrementUnreadCount(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.incr(`notifications:unread:${userId}`);
      await redis.expire(`notifications:unread:${userId}`, config.CACHE.UNREAD_COUNT_TTL);
    } catch {
      // Non critico
    }
  }

  private async decrementUnreadCount(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const val = await redis.decr(`notifications:unread:${userId}`);
      if (val < 0) await redis.set(`notifications:unread:${userId}`, '0');
    } catch {
      // Non critico
    }
  }

  private async resetUnreadCount(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(`notifications:unread:${userId}`);
    } catch {
      // Non critico
    }
  }
}
