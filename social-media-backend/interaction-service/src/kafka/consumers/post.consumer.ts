/**
 * Post Event Consumer — interaction-service
 *
 * Ascolta `post_events` e gestisce:
 *  - post_deleted → cancella a cascata tutti i like, commenti e share
 *    associati al post eliminato (GDPR + integrità referenziale cross-DB)
 *
 * NOTA: non gestisce post_created / post_updated — interaction-service non
 * necessita di mirroring locale dei post. Le validazioni post_id avvengono
 * via HTTP sincrono al momento della creazione dell'interazione.
 */

import { logger } from '../../utils/logger';

interface PostDeletedEvent {
  type: 'post_deleted' | string;
  entityId: string;  // postId
  userId: string;
  timestamp: string;
}

type PostEvent = PostDeletedEvent;

export class PostEventConsumer {
  /**
   * Entry-point chiamato da config/kafka.ts per ogni messaggio su `post_events`.
   * Idempotente: eliminare record già assenti non produce errori.
   */
  async processMessage(rawEvent: unknown): Promise<void> {
    let event: PostEvent;

    try {
      event =
        typeof rawEvent === 'string'
          ? (JSON.parse(rawEvent) as PostEvent)
          : (rawEvent as PostEvent);
    } catch {
      logger.error('PostEventConsumer: failed to parse event — invalid JSON', { rawEvent });
      return;
    }

    logger.debug('PostEventConsumer: processing event', { type: event.type, entityId: event.entityId });

    switch (event.type) {
      case 'post_deleted':
        await this.handlePostDeleted(event);
        break;

      case 'post_created':
      case 'post_updated':
      case 'post_scheduled':
        // Nessuna azione necessaria in interaction-service
        logger.debug('PostEventConsumer: event type ignored', { type: event.type });
        break;

      default:
        logger.warn('PostEventConsumer: unknown event type', { type: event.type });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Quando un post viene eliminato, elimina a cascata in interaction_db:
   *  1. Tutti i like sul post (target_type = 'POST', target_id = postId)
   *  2. Tutti i commenti root + nested (soft delete per audit trail)
   *  3. Tutte le share del post
   *  4. Tutti i like sui commenti del post (best-effort, via cascade DB se disponibile)
   *
   * L'operazione è best-effort su ogni entità: se una fallisce, le altre
   * vengono comunque tentate tramite Promise.allSettled().
   */
  private async handlePostDeleted(event: PostDeletedEvent): Promise<void> {
    const postId = event.entityId;
    if (!postId) {
      logger.warn('PostEventConsumer: post_deleted event missing entityId', { event });
      return;
    }

    try {
      // Lazy import per evitare dipendenze circolari al boot
      const { LikeModel } = await import('../../models/like.model');
      const { CommentModel } = await import('../../models/comment.model');
      const { ShareModel } = await import('../../models/share.model');

      const likeModel = new LikeModel();
      const commentModel = new CommentModel();
      const shareModel = new ShareModel();

      const results = await Promise.allSettled([
        likeModel.deleteByTarget(postId, 'POST'),
        commentModel.softDeleteByPost(postId),
        shareModel.deleteByPost(postId),
      ]);

      results.forEach((result, idx) => {
        const operations = ['likeModel.deleteByTarget', 'commentModel.softDeleteByPost', 'shareModel.deleteByPost'];
        if (result.status === 'rejected') {
          logger.error(`PostEventConsumer: ${operations[idx]} failed`, {
            postId,
            error: result.reason,
          });
        }
      });

      logger.info('PostEventConsumer: cascade delete completed for deleted post', { postId });
    } catch (error) {
      logger.error('PostEventConsumer: failed to handle post_deleted', { postId, error });
      throw error; // Kafka riproverà — la consistency cross-DB è critica
    }
  }
}

export default PostEventConsumer;
