/**
 * Kafka Consumer — interaction_events
 *
 * Gestisce: like_created, comment_created, share_created
 */

import { getKafkaConsumer } from '../../config/kafka';
import { NotificationService } from '../../services/notification.service';
import { logger } from '../../utils/logger';
import {
  LikeCreatedEvent,
  CommentCreatedEvent,
  ShareCreatedEvent,
  KafkaBaseEvent,
} from '../../types';

export class InteractionConsumer {
  private started = false;

  constructor(private readonly notificationService: NotificationService) {}

  async start(): Promise<void> {
    if (this.started) return;
    try {
      const consumer = getKafkaConsumer();
      await consumer.subscribe({ topics: ['interaction_events'], fromBeginning: false });
      this.started = true;
      logger.info('InteractionConsumer subscribed to interaction_events');

      await consumer.run({
        eachMessage: async ({ message }) => {
          const raw = message.value?.toString();
          if (!raw) return;
          try {
            const event = JSON.parse(raw) as KafkaBaseEvent;
            await this.handle(event);
          } catch (err) {
            logger.error('InteractionConsumer: failed to process message', { err });
          }
        },
      });
    } catch (err) {
      logger.warn('InteractionConsumer: could not subscribe', { err });
    }
  }

  private async handle(event: KafkaBaseEvent): Promise<void> {
    switch (event.type) {
      case 'like_created':
        await this.handleLikeCreated(event as LikeCreatedEvent);
        break;
      case 'comment_created':
        await this.handleCommentCreated(event as CommentCreatedEvent);
        break;
      case 'share_created':
        await this.handleShareCreated(event as ShareCreatedEvent);
        break;
      default:
        // Ignora altri eventi
    }
  }

  private async handleLikeCreated(event: LikeCreatedEvent): Promise<void> {
    const postAuthorId = event.payload?.postAuthorId;
    if (!postAuthorId) return;

    await this.notificationService.notify({
      recipientId: postAuthorId,
      actorId: event.userId,
      type: 'LIKE',
      entityId: event.entityId,
      entityType: event.payload?.targetType === 'POST' ? 'POST' : 'COMMENT',
      title: 'Nuovo like',
      body: 'Qualcuno ha messo like al tuo contenuto',
    });

    logger.debug('LikeCreated notification handled', { postAuthorId, actorId: event.userId });
  }

  private async handleCommentCreated(event: CommentCreatedEvent): Promise<void> {
    const { postAuthorId, parentAuthorId, postId } = event.payload ?? {};

    if (postAuthorId) {
      await this.notificationService.notify({
        recipientId: postAuthorId,
        actorId: event.userId,
        type: 'COMMENT',
        entityId: postId,
        entityType: 'POST',
        title: 'Nuovo commento',
        body: 'Qualcuno ha commentato il tuo post',
      });
    }

    if (parentAuthorId && parentAuthorId !== postAuthorId) {
      await this.notificationService.notify({
        recipientId: parentAuthorId,
        actorId: event.userId,
        type: 'COMMENT',
        entityId: event.entityId,
        entityType: 'COMMENT',
        title: 'Nuova risposta',
        body: 'Qualcuno ha risposto al tuo commento',
      });
    }

    logger.debug('CommentCreated notification handled', { postId });
  }

  private async handleShareCreated(event: ShareCreatedEvent): Promise<void> {
    const postAuthorId = event.payload?.postAuthorId;
    if (!postAuthorId) return;

    await this.notificationService.notify({
      recipientId: postAuthorId,
      actorId: event.userId,
      type: 'SHARE',
      entityId: event.entityId,
      entityType: 'POST',
      title: 'Post condiviso',
      body: 'Qualcuno ha condiviso il tuo post',
    });

    logger.debug('ShareCreated notification handled', { postAuthorId });
  }
}
