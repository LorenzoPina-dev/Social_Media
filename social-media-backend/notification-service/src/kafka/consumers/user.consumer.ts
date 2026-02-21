/**
 * Kafka Consumer — user_events
 *
 * Gestisce: follow_created, user_deleted (GDPR)
 */

import { getKafkaConsumer } from '../../config/kafka';
import { NotificationService } from '../../services/notification.service';
import { logger } from '../../utils/logger';
import { FollowCreatedEvent, UserDeletedEvent, KafkaBaseEvent } from '../../types';

export class UserEventConsumer {
  private started = false;

  constructor(private readonly notificationService: NotificationService) {}

  async start(): Promise<void> {
    if (this.started) return;
    try {
      const consumer = getKafkaConsumer();
      await consumer.subscribe({ topics: ['user_events'], fromBeginning: false });
      this.started = true;
      logger.info('UserEventConsumer subscribed to user_events');

      await consumer.run({
        eachMessage: async ({ message }) => {
          const raw = message.value?.toString();
          if (!raw) return;
          try {
            const event = JSON.parse(raw) as KafkaBaseEvent;
            await this.handle(event);
          } catch (err) {
            logger.error('UserEventConsumer: failed to process message', { err });
          }
        },
      });
    } catch (err) {
      logger.warn('UserEventConsumer: could not subscribe', { err });
    }
  }

  private async handle(event: KafkaBaseEvent): Promise<void> {
    switch (event.type) {
      case 'follow_created':
        await this.handleFollowCreated(event as FollowCreatedEvent);
        break;
      case 'user_deleted':
        await this.handleUserDeleted(event as UserDeletedEvent);
        break;
      default:
        // Ignora user_updated ecc.
    }
  }

  private async handleFollowCreated(event: FollowCreatedEvent): Promise<void> {
    const followingId = event.payload?.followingId;
    if (!followingId) return;

    await this.notificationService.notify({
      recipientId: followingId,           // chi viene seguito
      actorId: event.userId,              // chi ha seguito
      type: 'FOLLOW',
      entityId: event.userId,
      entityType: 'USER',
      title: 'Nuovo follower',
      body: 'Qualcuno ha iniziato a seguirti',
    });

    logger.debug('FollowCreated notification handled', { followingId, follower: event.userId });
  }

  /**
   * GDPR: elimina tutti i dati di notifica dell'utente cancellato
   */
  private async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    const userId = event.userId || event.entityId;
    if (!userId) {
      logger.warn('user_deleted event missing userId');
      return;
    }

    await this.notificationService.deleteUserData(userId);
    logger.info('GDPR: notification data deleted for user', { userId });
  }
}
