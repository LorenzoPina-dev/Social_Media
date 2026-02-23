/**
 * Interaction Event Consumer — topic: interaction_events
 *
 * Aggiorna i contatori denormalizzati nel DB di post-service:
 *  - like_created / like_deleted   → like_count su posts
 *  - comment_created / comment_deleted → comment_count su posts
 *  - share_created                 → share_count su posts
 *
 * Nota: i contatori Redis sono gestiti da interaction-service stesso.
 * Questo consumer aggiorna il DB source-of-truth in post_db.
 */

import { PostModel } from '../../models/post.model';
import { logger } from '../../utils/logger';

interface InteractionEvent {
  type:
    | 'like_created'
    | 'like_deleted'
    | 'comment_created'
    | 'comment_deleted'
    | 'share_created'
    | string;
  entityId: string;   // postId per like/share; commentId per comment
  userId: string;
  timestamp: string;
  payload?: {
    targetType?: 'POST' | 'COMMENT';
    postId?: string;          // presente in comment_created/comment_deleted
    parentId?: string | null;
    postAuthorId?: string;
    parentAuthorId?: string | null;
  };
}

export class InteractionEventConsumer {
  constructor(private postModel: PostModel) {}

  async processMessage(event: unknown): Promise<void> {
    const e = event as InteractionEvent;

    try {
      switch (e.type) {
        case 'like_created':
          await this.handleLikeCreated(e);
          break;
        case 'like_deleted':
          await this.handleLikeDeleted(e);
          break;
        case 'comment_created':
          await this.handleCommentCreated(e);
          break;
        case 'comment_deleted':
          await this.handleCommentDeleted(e);
          break;
        case 'share_created':
          await this.handleShareCreated(e);
          break;
        default:
          // Evento interaction non rilevante per post-service
          break;
      }
    } catch (error) {
      logger.error('Failed to handle interaction event', { error, event });
      throw error; // Kafka riproverà
    }
  }

  // ────────────────────────────────────────────────────────────────────────

  private async handleLikeCreated(e: InteractionEvent): Promise<void> {
    // Incrementa solo per like su POST (non commenti)
    if (e.payload?.targetType && e.payload.targetType !== 'POST') {
      logger.debug('like_created skipped — target is not a post', { targetType: e.payload.targetType });
      return;
    }

    const postId = e.entityId;
    await this.postModel.incrementCounter(postId, 'like_count');
    logger.debug('like_count incremented', { postId });
  }

  private async handleLikeDeleted(e: InteractionEvent): Promise<void> {
    if (e.payload?.targetType && e.payload.targetType !== 'POST') {
      return;
    }

    const postId = e.entityId;
    await this.postModel.decrementCounter(postId, 'like_count');
    logger.debug('like_count decremented', { postId });
  }

  private async handleCommentCreated(e: InteractionEvent): Promise<void> {
    // Per comment_created, entityId è il commentId, postId è nel payload
    const postId = e.payload?.postId;
    if (!postId) {
      logger.warn('comment_created event missing postId in payload', { event: e });
      return;
    }

    await this.postModel.incrementCounter(postId, 'comment_count');
    logger.debug('comment_count incremented', { postId, commentId: e.entityId });
  }

  private async handleCommentDeleted(e: InteractionEvent): Promise<void> {
    const postId = e.payload?.postId;
    if (!postId) {
      logger.warn('comment_deleted event missing postId in payload', { event: e });
      return;
    }

    await this.postModel.decrementCounter(postId, 'comment_count');
    logger.debug('comment_count decremented', { postId, commentId: e.entityId });
  }

  private async handleShareCreated(e: InteractionEvent): Promise<void> {
    const postId = e.entityId;
    await this.postModel.incrementCounter(postId, 'share_count');
    logger.debug('share_count incremented', { postId });
  }
}

export default InteractionEventConsumer;
