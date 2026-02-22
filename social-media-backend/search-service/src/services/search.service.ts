/**
 * SearchService — full-text search utenti e post su Elasticsearch
 */

import { ElasticsearchService } from './elasticsearch.service';
import { INDEX } from '../utils/setupElasticsearch';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import {
  SearchUsersDto,
  SearchPostsDto,
  SearchUserResult,
  SearchPostResult,
  SearchResult,
} from '../types';
import { config } from '../config';

export class SearchService {
  constructor(private readonly esService: ElasticsearchService) {}

  // ── Search Users ─────────────────────────────────────────────────────────

  async searchUsers(dto: SearchUsersDto): Promise<SearchResult<SearchUserResult>> {
    const start = Date.now();
    const limit = Math.min(dto.limit ?? config.SEARCH.DEFAULT_LIMIT, config.SEARCH.MAX_LIMIT);
    const offset = dto.offset ?? 0;

    try {
      // Costruisce query ES: multi_match su username e display_name con fuzzy
      const must: unknown[] = [
        {
          multi_match: {
            query: dto.q,
            fields: ['username^3', 'display_name^2', 'bio'],
            type: 'best_fields',
            fuzziness: 'AUTO',
            prefix_length: config.SEARCH.FUZZY_PREFIX_LENGTH,
          },
        },
        // Solo utenti ACTIVE
        { term: { status: 'ACTIVE' } },
      ];

      if (dto.verified === true) {
        must.push({ term: { verified: true } });
      }

      const { hits, total, took } = await this.esService.search<SearchUserResult>(
        INDEX.USERS,
        { bool: { must } },
        {
          from: offset,
          size: limit,
          sort: [{ _score: { order: 'desc' } }, { follower_count: { order: 'desc' } }],
        },
      );

      const duration = Date.now() - start;
      metrics.recordSearchRequest('users', 'success');
      metrics.recordSearchDuration('users', duration);
      logger.info('User search completed', { q: dto.q, total, took });

      return { hits, total, took };
    } catch (error) {
      metrics.recordSearchRequest('users', 'error');
      logger.error('User search failed', { dto, error });
      throw error;
    }
  }

  // ── Search Posts ─────────────────────────────────────────────────────────

  async searchPosts(dto: SearchPostsDto): Promise<SearchResult<SearchPostResult>> {
    const start = Date.now();
    const limit = Math.min(dto.limit ?? config.SEARCH.DEFAULT_LIMIT, config.SEARCH.MAX_LIMIT);
    const offset = dto.offset ?? 0;

    try {
      const must: unknown[] = [
        {
          multi_match: {
            query: dto.q,
            fields: ['content^2', 'hashtags'],
            type: 'best_fields',
            fuzziness: 'AUTO',
            prefix_length: config.SEARCH.FUZZY_PREFIX_LENGTH,
          },
        },
        { term: { visibility: 'PUBLIC' } },
      ];

      // Esclude post rifiutati dalla moderazione
      const mustNot: unknown[] = [
        { term: { moderation_status: 'REJECTED' } },
      ];

      // Filtro per hashtag specifico
      if (dto.hashtag) {
        must.push({ term: { hashtags: dto.hashtag.toLowerCase().replace(/^#/, '') } });
      }

      // Filtro per intervallo di date
      const dateRange: Record<string, string> = {};
      if (dto.from_date) dateRange.gte = dto.from_date;
      if (dto.to_date) dateRange.lte = dto.to_date;
      if (Object.keys(dateRange).length > 0) {
        must.push({ range: { created_at: dateRange } });
      }

      const { hits, total, took } = await this.esService.search<SearchPostResult>(
        INDEX.POSTS,
        { bool: { must, must_not: mustNot } },
        {
          from: offset,
          size: limit,
          sort: [{ _score: { order: 'desc' } }, { created_at: { order: 'desc' } }],
        },
      );

      const duration = Date.now() - start;
      metrics.recordSearchRequest('posts', 'success');
      metrics.recordSearchDuration('posts', duration);
      logger.info('Post search completed', { q: dto.q, total, took });

      return { hits, total, took };
    } catch (error) {
      metrics.recordSearchRequest('posts', 'error');
      logger.error('Post search failed', { dto, error });
      throw error;
    }
  }

  // ── Search by Hashtag ─────────────────────────────────────────────────────

  async searchByHashtag(
    hashtag: string,
    limit: number = config.SEARCH.DEFAULT_LIMIT,
    offset: number = 0,
  ): Promise<SearchResult<SearchPostResult>> {
    const tag = hashtag.toLowerCase().replace(/^#/, '');

    const { hits, total, took } = await this.esService.search<SearchPostResult>(
      INDEX.POSTS,
      {
        bool: {
          must: [
            { term: { hashtags: tag } },
            { term: { visibility: 'PUBLIC' } },
          ],
          must_not: [{ term: { moderation_status: 'REJECTED' } }],
        },
      },
      { from: offset, size: Math.min(limit, config.SEARCH.MAX_LIMIT), sort: [{ created_at: { order: 'desc' } }] },
    );

    return { hits, total, took };
  }
}
