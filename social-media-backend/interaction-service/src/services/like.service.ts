/**
 * Like Service — Business logic for likes
 */

import { LikeModel } from '../models/like.model';
import { CommentModel } from '../models/comment.model';
import { InteractionProducer } from '../kafka/producers/interaction.producer';
import { CounterService } from './counter.service';
import { Like, LikeTargetType, ConflictError, NotFoundError } from '../types';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

export class LikeService {
  constructor(
    private readonly likeModel: LikeModel,
    private readonly commentModel: CommentModel,
    private readonly counterService: CounterService,
    private readonly producer: InteractionProducer
  ) {}

  /**
   * Add a like to a post or comment.
   * Returns the updated count.
   */
  async addLike(
    userId: string,
    targetId: string,
    targetType: LikeTargetType
  ): Promise<{ like: Like; count: number }> {
    // Check idempotency
    const existing = await this.likeModel.findByUserAndTarget(userId, targetId, targetType);
    if (existing) {
      throw new ConflictError(`Already liked this ${targetType.toLowerCase()}`);
    }

    const like = await this.likeModel.create({ user_id: userId, target_id: targetId, target_type: targetType });

    // Increment Redis counter
    const count = await this.counterService.incrementLikes(targetId, targetType);

    // Track in user's liked-posts SET
    if (targetType === 'POST') {
      await this.counterService.addUserLike(userId, targetId);
    } else if (targetType === 'COMMENT') {
      // Increment comment's like_count in DB
      await this.commentModel.incrementLikeCount(targetId, 1);
    }

    // Publish Kafka event
    await this.producer.publishLikeCreated({
      type: 'like_created',
      entityId: targetId,
      userId,
      timestamp: new Date().toISOString(),
      payload: { targetType, targetId },
    });

    metrics.incrementCounter('like_created', { target_type: targetType });

    logger.info('Like added', { userId, targetId, targetType });
    return { like, count };
  }

  /**
   * Remove a like from a post or comment.
   * Returns the updated count.
   */
  async removeLike(
    userId: string,
    targetId: string,
    targetType: LikeTargetType
  ): Promise<{ count: number }> {
    const existing = await this.likeModel.findByUserAndTarget(userId, targetId, targetType);
    if (!existing) {
      throw new NotFoundError(`Like not found`);
    }

    await this.likeModel.delete(userId, targetId, targetType);

    // Decrement Redis counter
    const count = await this.counterService.decrementLikes(targetId, targetType);

    if (targetType === 'POST') {
      await this.counterService.removeUserLike(userId, targetId);
    } else if (targetType === 'COMMENT') {
      await this.commentModel.incrementLikeCount(targetId, -1);
    }

    await this.producer.publishLikeDeleted({
      type: 'like_deleted',
      entityId: targetId,
      userId,
      timestamp: new Date().toISOString(),
      payload: { targetType, targetId },
    });

    metrics.incrementCounter('like_deleted', { target_type: targetType });
    logger.info('Like removed', { userId, targetId, targetType });
    return { count };
  }

  /**
   * Get the like count for a target (try Redis first, fall back to DB).
   */
  async getLikeCount(targetId: string, targetType: LikeTargetType): Promise<number> {
    const cached = await this.counterService.getLikesCount(targetId);
    if (cached !== null) return cached;

    const count = await this.likeModel.countByTarget(targetId, targetType);
    return count;
  }

  /**
   * Check whether a user has liked a specific target.
   */
  async hasLiked(userId: string, targetId: string, targetType: LikeTargetType): Promise<boolean> {
    if (targetType === 'POST') {
      const cached = await this.counterService.hasUserLiked(userId, targetId);
      if (cached) return true;
    }
    const existing = await this.likeModel.findByUserAndTarget(userId, targetId, targetType);
    return !!existing;
  }
}
