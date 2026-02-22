/**
 * TrendingService — gestisce trending hashtags via Redis ZSET
 * Key: trending:hashtags | Type: ZSET | TTL: 3600s | Score: contatore utilizzi
 */

import { getRedisClient } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { TrendingHashtag } from '../types';
import { metrics } from '../utils/metrics';

const TRENDING_KEY = 'trending:hashtags';
const WINDOW_KEY = 'trending:hashtags:window';    // per reset periodico

export class TrendingService {
  // ── Increment ────────────────────────────────────────────────────────────

  async incrementHashtags(tags: string[]): Promise<void> {
    try {
      const redis = getRedisClient();
      const pipeline = redis.pipeline();

      for (const tag of tags) {
        pipeline.zincrby(TRENDING_KEY, 1, tag);
      }

      // Mantieni TTL fresco
      pipeline.expire(TRENDING_KEY, config.CACHE.TRENDING_TTL);
      await pipeline.exec();

      logger.debug('Trending hashtags incremented', { tags });
    } catch (error) {
      logger.error('Failed to increment trending hashtags', { error });
      // Non rilancia — il trending è non-critico
    }
  }

  // ── Get Top N ────────────────────────────────────────────────────────────

  async getTopHashtags(n: number = config.SEARCH.TRENDING_TOP_N): Promise<TrendingHashtag[]> {
    try {
      const redis = getRedisClient();

      // ZRANGEBYSCORE in ordine decrescente → top N
      const results = await redis.zrevrangebyscore(
        TRENDING_KEY,
        '+inf',
        '-inf',
        'WITHSCORES',
        'LIMIT',
        0,
        n,
      );

      const trending: TrendingHashtag[] = [];
      for (let i = 0; i < results.length; i += 2) {
        trending.push({
          tag: results[i],
          score: parseFloat(results[i + 1]),
        });
      }

      metrics.recordCacheHit('trending');
      return trending;
    } catch (error) {
      logger.error('Failed to get trending hashtags', { error });
      metrics.recordCacheMiss('trending');
      return [];
    }
  }

  // ── Reset (chiamato da cron periodico opzionale) ──────────────────────────

  async reset(): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(TRENDING_KEY, WINDOW_KEY);
      logger.info('Trending hashtags reset');
    } catch (error) {
      logger.error('Failed to reset trending hashtags', { error });
    }
  }

  // ── Score di un singolo tag ───────────────────────────────────────────────

  async getScore(tag: string): Promise<number> {
    try {
      const redis = getRedisClient();
      const score = await redis.zscore(TRENDING_KEY, tag);
      return score ? parseFloat(score) : 0;
    } catch {
      return 0;
    }
  }
}
