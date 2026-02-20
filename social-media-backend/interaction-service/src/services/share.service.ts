/**
 * Share Service — Business logic for shares
 */

import { ShareModel } from '../models/share.model';
import { InteractionProducer } from '../kafka/producers/interaction.producer';
import { Share, CreateShareDto, ConflictError } from '../types';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

export class ShareService {
  constructor(
    private readonly shareModel: ShareModel,
    private readonly producer: InteractionProducer
  ) {}

  /**
   * Share a post (idempotent — one share per user/post).
   */
  async createShare(data: CreateShareDto): Promise<{ share: Share; count: number }> {
    const existing = await this.shareModel.findByUserAndPost(data.user_id, data.post_id);
    if (existing) {
      throw new ConflictError('You have already shared this post');
    }

    const share = await this.shareModel.create(data);
    const count = await this.shareModel.countByPost(data.post_id);

    await this.producer.publishShareCreated({
      type: 'share_created',
      entityId: data.post_id,
      userId: data.user_id,
      timestamp: new Date().toISOString(),
      payload: { shareId: share.id, comment: data.comment },
    });

    metrics.incrementCounter('share_created');
    logger.info('Post shared', { userId: data.user_id, postId: data.post_id });

    return { share, count };
  }

  /**
   * Get share count for a post.
   */
  async getShareCount(postId: string): Promise<number> {
    return this.shareModel.countByPost(postId);
  }

  /**
   * Get users who shared a post (paginated).
   */
  async getSharesByPost(
    postId: string,
    limit = 20,
    cursor?: string
  ): Promise<{ shares: Share[]; hasMore: boolean; cursor?: string }> {
    const fetchLimit = limit + 1;
    const shares = await this.shareModel.findByPost(postId, fetchLimit, cursor);

    const hasMore = shares.length > limit;
    const items = hasMore ? shares.slice(0, limit) : shares;
    const nextCursor = hasMore
      ? items[items.length - 1].created_at.toISOString()
      : undefined;

    return { shares: items, hasMore, cursor: nextCursor };
  }
}
