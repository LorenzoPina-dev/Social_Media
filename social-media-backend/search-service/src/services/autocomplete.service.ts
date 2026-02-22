/**
 * AutocompleteService — suggerimenti rapidi con cache Redis L2 → ES completion
 * Key pattern: suggest:{type}:{prefix} | TTL: 300s
 */

import { ElasticsearchService } from './elasticsearch.service';
import { getRedisClient } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { SuggestResult } from '../types';
import { INDEX } from '../utils/setupElasticsearch';

export class AutocompleteService {
  constructor(private readonly esService: ElasticsearchService) {}

  // ── Suggest ──────────────────────────────────────────────────────────────

  async suggest(
    prefix: string,
    type: 'user' | 'hashtag' | 'all' = 'all',
    limit: number = 10,
  ): Promise<SuggestResult[]> {
    if (!prefix || prefix.trim().length < 1) return [];

    const normalizedPrefix = prefix.trim().toLowerCase();
    const cacheKey = `suggest:${type}:${normalizedPrefix}`;

    // L2 — Redis cache
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        metrics.recordCacheHit('autocomplete');
        return JSON.parse(cached) as SuggestResult[];
      }
      metrics.recordCacheMiss('autocomplete');
    } catch (error) {
      logger.warn('Redis cache read failed for autocomplete', { error });
    }

    // L3 — Elasticsearch
    const results: SuggestResult[] = [];

    try {
      if (type === 'user' || type === 'all') {
        const userSuggestions = await this.esService.suggest(
          INDEX.USERS,
          'username.suggest',
          normalizedPrefix,
          limit,
        );
        for (const text of userSuggestions) {
          results.push({ type: 'user', text });
        }
      }

      if (type === 'hashtag' || type === 'all') {
        const hashtagSuggestions = await this.esService.suggest(
          INDEX.HASHTAGS,
          'suggest',
          normalizedPrefix,
          limit,
        );
        for (const text of hashtagSuggestions) {
          results.push({ type: 'hashtag', text });
        }
      }

      // Deduplica e limita
      const deduped = Array.from(
        new Map(results.map((r) => [`${r.type}:${r.text}`, r])).values(),
      ).slice(0, limit);

      // Popola cache Redis
      try {
        const redis = getRedisClient();
        await redis.setex(cacheKey, config.CACHE.AUTOCOMPLETE_TTL, JSON.stringify(deduped));
      } catch (error) {
        logger.warn('Redis cache write failed for autocomplete', { error });
      }

      return deduped;
    } catch (error) {
      logger.error('Autocomplete suggest failed', { prefix, type, error });
      return [];
    }
  }

  // ── Invalidate cache per un prefisso ─────────────────────────────────────
  // Chiamato quando un documento viene aggiornato/eliminato

  async invalidateCache(prefix: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const pattern = `suggest:*:${prefix.toLowerCase()}*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug('Autocomplete cache invalidated', { prefix, keysDeleted: keys.length });
      }
    } catch (error) {
      logger.warn('Failed to invalidate autocomplete cache', { error });
    }
  }
}
