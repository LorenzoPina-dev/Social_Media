/**
 * Cache Service — Redis L2 cache per post-service
 */

import { getRedisClient } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Post, Hashtag } from '../types';

export class CacheService {
  private get redis() {
    return getRedisClient();
  }

  // ─── Post cache ──────────────────────────────────────────────────────────

  async getPost(id: string): Promise<Post | null> {
    try {
      const data = await this.redis.get(`post:${id}`);
      return data ? (JSON.parse(data) as Post) : null;
    } catch (error) {
      logger.warn('Cache get post failed', { error, id });
      return null;
    }
  }

  async setPost(post: Post): Promise<void> {
    try {
      await this.redis.setex(`post:${post.id}`, config.CACHE.POST_TTL, JSON.stringify(post));
    } catch (error) {
      logger.warn('Cache set post failed', { error, postId: post.id });
    }
  }

  async deletePost(id: string): Promise<void> {
    try {
      await this.redis.del(`post:${id}`);
    } catch (error) {
      logger.warn('Cache delete post failed', { error, id });
    }
  }

  // ─── Trending hashtags ────────────────────────────────────────────────────

  async getTrendingHashtags(): Promise<Hashtag[] | null> {
    try {
      const data = await this.redis.get('trending:hashtags:list');
      return data ? (JSON.parse(data) as Hashtag[]) : null;
    } catch {
      return null;
    }
  }

  async setTrendingHashtags(hashtags: Hashtag[]): Promise<void> {
    try {
      await this.redis.setex('trending:hashtags:list', config.CACHE.TRENDING_TTL, JSON.stringify(hashtags));
    } catch (error) {
      logger.warn('Cache set trending hashtags failed', { error });
    }
  }

  async invalidateTrendingHashtags(): Promise<void> {
    try {
      await this.redis.del('trending:hashtags:list');
    } catch {
      // ignore
    }
  }

  // ─── Generic ──────────────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttl: number): Promise<void> {
    try {
      await this.redis.setex(key, ttl, value);
    } catch (error) {
      logger.warn('Cache set failed', { error, key });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      // ignore
    }
  }
}
