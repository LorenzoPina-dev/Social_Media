/**
 * Counter Service
 *
 * Manages Redis counters for likes / comments / shares.
 * Counters are written to Redis immediately and flushed to PostgreSQL periodically.
 */

import { getRedisClient } from '../config/redis';
import { getDatabase } from '../config/database';
import { logger } from '../utils/logger';
import { config } from '../config';
import { LikeTargetType } from '../types';

export class CounterService {
  // ── Redis key builders ──────────────────────────────────────────────────────

  private likesCountKey(targetId: string): string {
    return `likes:count:${targetId}`;
  }

  private commentsCountKey(postId: string): string {
    return `comments:count:${postId}`;
  }

  private userLikedPostsKey(userId: string): string {
    return `likes:user:${userId}:posts`;
  }

  // ── Likes counter ───────────────────────────────────────────────────────────

  async incrementLikes(targetId: string, targetType: LikeTargetType): Promise<number> {
    try {
      const redis = getRedisClient();
      const key = this.likesCountKey(targetId);
      const count = await redis.incr(key);
      await redis.expire(key, config.CACHE.LIKES_COUNT_TTL);
      logger.debug('Incremented like counter', { targetId, targetType, count });
      return count;
    } catch (error) {
      logger.error('Failed to increment likes counter in Redis', { error, targetId });
      return 0;
    }
  }

  async decrementLikes(targetId: string, targetType: LikeTargetType): Promise<number> {
    try {
      const redis = getRedisClient();
      const key = this.likesCountKey(targetId);
      const count = await redis.decr(key);
      await redis.expire(key, config.CACHE.LIKES_COUNT_TTL);
      logger.debug('Decremented like counter', { targetId, targetType, count });
      return Math.max(0, count);
    } catch (error) {
      logger.error('Failed to decrement likes counter in Redis', { error, targetId });
      return 0;
    }
  }

  async getLikesCount(targetId: string): Promise<number | null> {
    try {
      const redis = getRedisClient();
      const val = await redis.get(this.likesCountKey(targetId));
      return val !== null ? parseInt(val, 10) : null;
    } catch {
      return null;
    }
  }

  // ── Comments counter ─────────────────────────────────────────────────────────

  async incrementComments(postId: string): Promise<number> {
    try {
      const redis = getRedisClient();
      const key = this.commentsCountKey(postId);
      const count = await redis.incr(key);
      await redis.expire(key, config.CACHE.COMMENTS_COUNT_TTL);
      return count;
    } catch (error) {
      logger.error('Failed to increment comments counter', { error, postId });
      return 0;
    }
  }

  async decrementComments(postId: string): Promise<number> {
    try {
      const redis = getRedisClient();
      const key = this.commentsCountKey(postId);
      const count = await redis.decr(key);
      await redis.expire(key, config.CACHE.COMMENTS_COUNT_TTL);
      return Math.max(0, count);
    } catch (error) {
      logger.error('Failed to decrement comments counter', { error, postId });
      return 0;
    }
  }

  // ── User liked posts SET ────────────────────────────────────────────────────

  async addUserLike(userId: string, targetId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = this.userLikedPostsKey(userId);
      await redis.sadd(key, targetId);
      await redis.expire(key, config.CACHE.USER_LIKES_TTL);
    } catch (error) {
      logger.error('Failed to add user like to Redis set', { error });
    }
  }

  async removeUserLike(userId: string, targetId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.srem(this.userLikedPostsKey(userId), targetId);
    } catch (error) {
      logger.error('Failed to remove user like from Redis set', { error });
    }
  }

  async hasUserLiked(userId: string, targetId: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      return (await redis.sismember(this.userLikedPostsKey(userId), targetId)) === 1;
    } catch {
      return false;
    }
  }

  // ── Reconcile counters (flush Redis → PostgreSQL) ───────────────────────────

  async reconcileLikesToDb(): Promise<void> {
    const db = getDatabase();
    const redis = getRedisClient();

    try {
      // Find all `likes:count:*` keys
      const keys = await redis.keys('likes:count:*');
      if (keys.length === 0) return;

      for (const key of keys) {
        const targetId = key.replace('likes:count:', '');
        const val = await redis.get(key);
        if (val === null) continue;

        const count = parseInt(val, 10);

        // Update the actual like_count on the `likes` table parent entity
        // Post service and comment service own those counters — we publish events instead
        // Here we reconcile the interaction_db `comments.like_count`
        await db('comments')
          .where({ id: targetId })
          .whereNull('deleted_at')
          .update({ like_count: count });
      }

      logger.debug('Reconciled like counters to DB', { keysProcessed: keys.length });
    } catch (error) {
      logger.error('Failed to reconcile counters', { error });
    }
  }

  startPeriodicFlush(): NodeJS.Timeout {
    const intervalMs = config.CACHE.COUNTER_FLUSH_INTERVAL * 1000;
    return setInterval(() => {
      this.reconcileLikesToDb().catch(err =>
        logger.error('Periodic counter flush failed', { err })
      );
    }, intervalMs);
  }
}
