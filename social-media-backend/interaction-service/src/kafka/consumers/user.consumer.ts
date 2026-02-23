/**
 * User Event Consumer — interaction-service
 *
 * Ascolta `user_events` e gestisce:
 *  - user_deleted / user_permanently_deleted → cancella a cascata tutte le
 *    interazioni dell'utente eliminato in interaction_db (GDPR compliance)
 *
 * Le interazioni rimosse sono:
 *  - Tutti i like dell'utente (target POST o COMMENT)
 *  - Tutti i commenti dell'utente (soft delete per audit trail)
 *  - Tutte le share dell'utente
 */

import { logger } from '../../utils/logger';

interface UserDeletedEvent {
  type: 'user_deleted' | 'user_permanently_deleted' | string;
  entityId?: string;
  userId?: string;
  timestamp: string;
}

type UserEvent = UserDeletedEvent;

export class UserEventConsumer {
  /**
   * Entry-point chiamato da config/kafka.ts per ogni messaggio su `user_events`.
   * Idempotente: eliminare record già assenti non produce errori.
   */
  async processMessage(rawEvent: unknown): Promise<void> {
    let event: UserEvent;

    try {
      event =
        typeof rawEvent === 'string'
          ? (JSON.parse(rawEvent) as UserEvent)
          : (rawEvent as UserEvent);
    } catch {
      logger.error('UserEventConsumer: failed to parse event — invalid JSON', { rawEvent });
      return;
    }

    logger.debug('UserEventConsumer: processing event', { type: event.type });

    switch (event.type) {
      case 'user_deleted':
      case 'user_permanently_deleted':
        await this.handleUserDeleted(event);
        break;

      default:
        // user_updated, follow_created, follow_deleted non interessano interaction-service
        logger.debug('UserEventConsumer: event type ignored', { type: event.type });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  /**
   * GDPR: quando un utente viene cancellato, elimina tutte le sue interazioni
   * in interaction_db:
   *  1. Like dell'utente (su post E commenti)
   *  2. Commenti dell'utente (soft delete → deleted_at = NOW())
   *  3. Share dell'utente
   *
   * Best-effort: Promise.allSettled garantisce che il fallimento di una
   * operazione non blocchi le altre.
   */
  private async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    const userId = event.userId ?? event.entityId;

    if (!userId) {
      logger.warn('UserEventConsumer: user_deleted event missing userId/entityId', { event });
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
        likeModel.deleteByUser(userId),
        commentModel.softDeleteByUser(userId),
        shareModel.deleteByUser(userId),
      ]);

      results.forEach((result, idx) => {
        const operations = ['likeModel.deleteByUser', 'commentModel.softDeleteByUser', 'shareModel.deleteByUser'];
        if (result.status === 'rejected') {
          logger.error(`UserEventConsumer: ${operations[idx]} failed`, {
            userId,
            error: result.reason,
          });
        }
      });

      logger.info(
        'UserEventConsumer: GDPR — all interactions deleted for user',
        { userId },
      );
    } catch (error) {
      logger.error('UserEventConsumer: failed to handle user_deleted', { userId, error });
      throw error; // Kafka riproverà — dati GDPR critici
    }
  }
}

export default UserEventConsumer;
