/**
 * Moderation Event Consumer — topic: moderation_events
 *
 * Aggiorna moderation_status del post quando la moderazione decide
 */

import { PostModel } from '../../models/post.model';
import { CacheService } from '../../services/cache.service';
import { logger } from '../../utils/logger';

interface ModerationEvent {
  type: 'content_flagged' | 'content_approved' | 'content_rejected' | string;
  entityId: string;
  userId: string;
  timestamp: string;
  payload?: {
    entityType?: string;
    mlScore?: number;
    reason?: string;
    decidedBy?: string;
  };
}

export class ModerationEventConsumer {
  constructor(
    private postModel: PostModel,
    private cacheService: CacheService,
  ) {}

  async processMessage(event: unknown): Promise<void> {
    const e = event as ModerationEvent;
    // Only process events for POST entities
    if (e.payload?.entityType && e.payload.entityType !== 'POST') return;

    try {
      switch (e.type) {
        case 'content_flagged':
          await this.postModel.updateModerationStatus(e.entityId, 'FLAGGED');
          await this.cacheService.deletePost(e.entityId);
          logger.info('Post flagged by moderation', { postId: e.entityId, score: e.payload?.mlScore });
          break;

        case 'content_approved':
          await this.postModel.updateModerationStatus(e.entityId, 'APPROVED');
          await this.cacheService.deletePost(e.entityId);
          logger.info('Post approved by moderation', { postId: e.entityId });
          break;

        case 'content_rejected':
          await this.postModel.updateModerationStatus(e.entityId, 'REJECTED');
          await this.cacheService.deletePost(e.entityId);
          logger.info('Post rejected by moderation', { postId: e.entityId, reason: e.payload?.reason });
          break;

        default:
          break;
      }
    } catch (error) {
      logger.error('Failed to handle moderation event', { error, event });
      throw error;
    }
  }
}

export default ModerationEventConsumer;
