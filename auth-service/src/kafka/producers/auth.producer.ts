/**
 * Auth Producer
 * Publishes authentication events to Kafka
 */

import { getKafkaProducer } from '../../config/kafka';
import { logger } from '../../utils/logger';
import { AuthEvent } from '../../types';

export class AuthProducer {
  private readonly topic = 'auth_events';

  /**
   * Publish authentication event
   */
  async publishEvent(event: AuthEvent): Promise<void> {
    try {
      const producer = getKafkaProducer();

      await producer.send({
        topic: this.topic,
        messages: [
          {
            key: event.userId,
            value: JSON.stringify(event),
            timestamp: new Date().getTime().toString(),
          },
        ],
      });

      logger.debug('Auth event published', { eventType: event.type, userId: event.userId });
    } catch (error) {
      logger.error('Failed to publish auth event', { error, event });
      // Don't throw - we don't want to fail the request if Kafka is down
    }
  }

  /**
   * Publish user authenticated event
   */
  async publishUserAuthenticated(event: Extract<AuthEvent,  { type: 'user_authenticated' }>): Promise<void> {
    await this.publishEvent(event);
  }

  /**
   * Publish user registered event
   */
  async publishUserRegistered(event: Extract<AuthEvent,  { type: 'user_registered' }>): Promise<void> {
    await this.publishEvent(event);
  }

  /**
   * Publish password changed event
   */
  async publishPasswordChanged(event: Extract<AuthEvent, { type: 'password_changed' }>): Promise<void> {
    await this.publishEvent(event);
  }

  /**
   * Publish MFA enabled event
   */
  async publishMFAEnabled(event: Extract<AuthEvent, { type: 'mfa_enabled' }>): Promise<void> {
    await this.publishEvent(event);
  }

  /**
   * Publish suspicious login event
   */
  async publishSuspiciousLogin(event: Extract<AuthEvent, { type: 'suspicious_login' }> ): Promise<void> {
    await this.publishEvent(event);
  }
}
