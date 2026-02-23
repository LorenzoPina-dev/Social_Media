/**
 * Kafka Consumer — post_events
 *
 * Gestisce: post_created → notifica follower (quando post è PUBLIC)
 *
 * NOTA: processMessage() è chiamato dal dispatcher centrale in app.ts.
 * Il fan-out ai follower richiede una chiamata HTTP a user-service
 * per recuperare la lista dei follower dell'autore del post.
 */

import { NotificationService } from '../../services/notification.service';
import { logger } from '../../utils/logger';
import { PostCreatedEvent, KafkaBaseEvent } from '../../types';

export class PostEventConsumer {
  constructor(private readonly notificationService: NotificationService) {}

  async processMessage(event: unknown): Promise<void> {
    const e = event as KafkaBaseEvent;
    try {
      await this.handle(e);
    } catch (err) {
      logger.error('PostEventConsumer: failed to process message', { type: e.type, err });
    }
  }

  private async handle(event: KafkaBaseEvent): Promise<void> {
    if (event.type === 'post_created') {
      await this.handlePostCreated(event as PostCreatedEvent);
    }
    // post_deleted / post_updated: nessuna notifica necessaria
  }

  /**
   * Notifica i follower quando un utente pubblica un post PUBLIC.
   *
   * Il fan-out completo verso tutti i follower è un'operazione potenzialmente
   * costosa ed è delegata al notification-service come consumer event-driven.
   * Per il MVP, viene emessa una notifica aggregata (placeholder).
   *
   * TODO: recuperare follower da user-service via HTTP e notificare ciascuno
   * che ha la preferenza `likes_push = true`.
   */
  private async handlePostCreated(event: PostCreatedEvent): Promise<void> {
    if (event.payload?.visibility !== 'PUBLIC') {
      logger.debug('PostCreated skipped — not PUBLIC', {
        postId: event.entityId,
        visibility: event.payload?.visibility,
      });
      return;
    }

    logger.info('PostCreated received by notification-service', {
      postId: event.entityId,
      userId: event.userId,
    });

    // TODO: chiamata HTTP a user-service GET /users/{userId}/followers
    // e invio notifica individuale per ogni follower con preferenza abilitata.
    // Esempio:
    // const followerIds = await fetchFollowerIds(event.userId);
    // for (const followerId of followerIds) {
    //   await this.notificationService.notifyIfPreferred(followerId, 'NEW_POST', event);
    // }

    logger.debug('PostCreated: follower notification fan-out (TODO: implement HTTP call)', {
      postId: event.entityId,
    });
  }
}
