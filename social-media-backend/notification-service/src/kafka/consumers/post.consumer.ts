/**
 * Kafka Consumer — post_events (notification-service)
 *
 * Gestisce:
 *   post_created → notifica follower (NEW_POST) + emette feed:new_post via WebSocket
 *
 * Il fan-out real-time avviene su due canali in parallelo:
 *   1. notification:new  — notifica in-app tradizionale (già persistita in DB)
 *   2. feed:new_post     — evento leggero che dice al client di inserire il post
 *                          in cima al feed senza ricaricare l'intera pagina.
 *
 * Visibilità supportate:
 *   PUBLIC    → notifica + feed update a tutti i follower
 *   FOLLOWERS → solo feed update ai follower (nessuna notifica push)
 *   PRIVATE   → nessun fan-out
 */

import { NotificationService } from '../../services/notification.service';
import { websocketService } from '../../services/websocket.service';
import { fetchFollowerIds, fetchUserInfo } from '../../services/http.service';
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
   * Fan-out real-time ai follower quando viene pubblicato un post.
   *
   * Emette due eventi WebSocket distinti:
   *  - feed:new_post  → tutti i follower (PUBLIC + FOLLOWERS)
   *  - notification:new → solo per post PUBLIC (notifica visibile)
   */
  private async handlePostCreated(event: PostCreatedEvent): Promise<void> {
    const visibility = event.payload?.visibility;
    const postId = event.entityId;
    const authorId = event.userId;

    // PRIVATE: nessun fan-out
    if (visibility === 'PRIVATE') {
      logger.debug('PostCreated skipped — PRIVATE', { postId });
      return;
    }

    logger.info('PostCreated: starting real-time fan-out', { postId, authorId, visibility });

    // Recupera follower e info autore in parallelo
    const [{ followerIds }, actor] = await Promise.all([
      fetchFollowerIds(authorId),
      fetchUserInfo(authorId),
    ]);

    if (followerIds.length === 0) {
      logger.debug('PostCreated: no followers to notify', { authorId });
      return;
    }

    const actorName = actor?.display_name || actor?.username || 'Qualcuno';

    // ── 1. feed:new_post ─────────────────────────────────────────────────────
    // Evento leggero: il client lo intercetta e aggiunge il post in cima al feed
    // senza ricaricare l'intera pagina. Inviato a tutti i follower, per
    // entrambe le visibilità PUBLIC e FOLLOWERS.
    await websocketService.emitToUsers(followerIds, 'feed:new_post', {
      postId,
      authorId,
      visibility,
      timestamp: event.timestamp,
    });

    logger.info('PostCreated: feed:new_post emitted', {
      postId,
      recipients: followerIds.length,
      visibility,
    });

    // ── 2. notification:new (solo PUBLIC) ────────────────────────────────────
    // Per i post FOLLOWERS non mandiamo la notifica push/in-app: il follower
    // vedrà il post nel feed ma non riceverà un alert distinto.
    if (visibility !== 'PUBLIC') return;

    // Fan-out notifiche in batch (best-effort, errori individuali non bloccano)
    await Promise.allSettled(
      followerIds.map((followerId) =>
        this.notificationService.notify({
          recipientId: followerId,
          actorId: authorId,
          type: 'system',
          entityId: postId,
          entityType: 'POST',
          title: 'Nuovo post',
          body: `${actorName} ha pubblicato qualcosa di nuovo`,
          data: { postId, authorId },
        }),
      ),
    );

    logger.info('PostCreated: notification fan-out complete', {
      postId,
      recipients: followerIds.length,
    });
  }
}
