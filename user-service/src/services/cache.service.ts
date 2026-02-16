/**
 * Cache Service
 * Multi-tier caching strategy with Redis
 */

import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { User } from '../types';
import { config } from '../config';

export class CacheService {
  private redis = getRedisClient();

  /**
   * Get user from cache
   */
  async getUser(userId: string): Promise<User | null> {
    try {
      const key = this.getUserKey(userId);
      const cached = await this.redis.get(key);

      if (cached) {
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Failed to get user from cache', { error, userId });
      return null; // Fail gracefully
    }
  }

  /**
   * Set user in cache
   */
  async setUser(user: User): Promise<void> {
    try {
      const key = this.getUserKey(user.id);
      await this.redis.setex(
        key,
        config.CACHE.PROFILE_TTL,
        JSON.stringify(user)
      );
    } catch (error) {
      logger.error('Failed to set user in cache', { error, userId: user.id });
      // Don't throw, just log
    }
  }

  /**
   * Delete user from cache
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const key = this.getUserKey(userId);
      await this.redis.del(key);
    } catch (error) {
      logger.error('Failed to delete user from cache', { error, userId });
    }
  }

  /**
   * Get generic value from cache
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      logger.error('Failed to get from cache', { error, key });
      return null;
    }
  }

  /**
   * Set generic value in cache
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      logger.error('Failed to set in cache', { error, key });
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Failed to delete from cache', { error, key });
    }
  }

  /**
   * Cache followers list
   */
  async setFollowers(userId: string, followers: any[]): Promise<void> {
    try {
      const key = `followers:${userId}`;
      await this.redis.setex(
        key,
        config.CACHE.FOLLOWERS_TTL,
        JSON.stringify(followers)
      );
    } catch (error) {
      logger.error('Failed to cache followers', { error, userId });
    }
  }

  /**
   * Get followers from cache
   */
  async getFollowers(userId: string): Promise<any[] | null> {
    try {
      const key = `followers:${userId}`;
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Failed to get followers from cache', { error, userId });
      return null;
    }
  }

  /**
   * Invalidate followers cache
   */
  async invalidateFollowers(userId: string): Promise<void> {
    try {
      await this.redis.del(`followers:${userId}`);
      await this.redis.del(`following:${userId}`);
    } catch (error) {
      logger.error('Failed to invalidate followers cache', { error, userId });
    }
  }

  /**
   * Generate user cache key
   */
  private getUserKey(userId: string): string {
    return `user:${userId}`;
  }
}
