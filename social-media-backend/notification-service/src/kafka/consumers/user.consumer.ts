/**
 * Kafka Consumer — user_events
 *
 * Gestisce: follow_created, user_deleted (GDPR)
 *
 * NOTA: processMessage() è chiamato dal dispatcher centrale in app.ts.
 */

import { NotificationService } from '../../services/notification.service';
import { logger } from '../../utils/logger';
import {
  FollowCreatedEvent,
  UserDeletedEvent,
  KafkaBaseEvent,
  MessageSentEvent,
} from '../../types';

export class UserEventConsumer {
  constructor(private readonly notificationService: NotificationService) {}

  async processMessage(event: unknown): Promise<void> {
    const e = event as KafkaBaseEvent;
    try {
      await this.handle(e);
    } catch (err) {
      logger.error('UserEventConsumer: failed to process message', { type: e.type, err });
    }
  }

  private async handle(event: KafkaBaseEvent): Promise<void> {
    switch (event.type) {
      case 'follow_created':
      case 'user_followed':
        await this.handleFollowCreated(event as FollowCreatedEvent);
        break;
      case 'message_sent':
        await this.handleMessageSent(event as MessageSentEvent);
        break;
      case 'user_deleted':
      case 'user_permanently_deleted':
        await this.handleUserDeleted(event as UserDeletedEvent);
        break;
      default:
        // Ignora user_updated, follow_deleted ecc.
    }
  }

  private async handleFollowCreated(event: FollowCreatedEvent): Promise<void> {
    const followingId = (event.payload?.followingId || (event as any).followingId) as
      | string
      | undefined;
    if (!followingId) return;

    // Non notificare se si segue se stessi (caso edge)
    if (followingId === event.userId) return;

    await this.notificationService.notify({
      recipientId: followingId,           // chi viene seguito riceve la notifica
      actorId: event.userId,              // chi ha premuto "segui"
      type: 'follow',
      entityId: event.userId,
      entityType: 'USER',
      title: 'Nuovo follower',
      body: 'Qualcuno ha iniziato a seguirti',
    });

    logger.debug('FollowCreated notification handled', { followingId, follower: event.userId });
  }

  private async handleMessageSent(event: MessageSentEvent): Promise<void> {
    const recipientId = event.payload?.recipientId;
    if (!recipientId) return;

    if (recipientId === event.userId) return;

    await this.notificationService.notify({
      recipientId,
      actorId: event.userId,
      type: 'system',
      entityId: event.payload.messageId || event.payload.conversationId,
      entityType: 'USER',
      title: 'Nuovo messaggio',
      body: 'Hai ricevuto un nuovo messaggio',
      data: {
        conversationId: event.payload.conversationId,
        messageId: event.payload.messageId,
        senderId: event.userId,
      },
    });
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
