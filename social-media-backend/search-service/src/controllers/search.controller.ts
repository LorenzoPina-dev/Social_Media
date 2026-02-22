/**
 * Search Controller — HTTP handlers per tutti gli endpoint di ricerca
 */

import { Request, Response } from 'express';
import { SearchService } from '../services/search.service';
import { AutocompleteService } from '../services/autocomplete.service';
import { TrendingService } from '../services/trending.service';
import { logger } from '../utils/logger';

export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly autocompleteService: AutocompleteService,
    private readonly trendingService: TrendingService,
  ) {}

  // ── GET /search/users?q=...&limit=...&offset=...&verified=... ─────────────

  async searchUsers(req: Request, res: Response): Promise<void> {
    const { q, limit, offset, verified } = req.query as Record<string, string>;

    logger.info('Search users request', { q, limit, offset, verified });

    const result = await this.searchService.searchUsers({
      q,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      verified: verified === 'true' ? true : undefined,
    });

    res.json({
      success: true,
      data: result.hits,
      meta: {
        total: result.total,
        took: result.took,
        limit: parseInt(limit ?? '20', 10),
        offset: parseInt(offset ?? '0', 10),
      },
    });
  }

  // ── GET /search/posts?q=...&limit=...&offset=...&hashtag=...&from_date=...&to_date=... ──

  async searchPosts(req: Request, res: Response): Promise<void> {
    const { q, limit, offset, hashtag, from_date, to_date } = req.query as Record<string, string>;

    logger.info('Search posts request', { q, hashtag });

    const result = await this.searchService.searchPosts({
      q,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      hashtag: hashtag ?? undefined,
      from_date: from_date ?? undefined,
      to_date: to_date ?? undefined,
    });

    res.json({
      success: true,
      data: result.hits,
      meta: {
        total: result.total,
        took: result.took,
        limit: parseInt(limit ?? '20', 10),
        offset: parseInt(offset ?? '0', 10),
      },
    });
  }

  // ── GET /search/hashtag/:tag ─────────────────────────────────────────────

  async searchByHashtag(req: Request, res: Response): Promise<void> {
    const { tag } = req.params;
    const { limit, offset } = req.query as Record<string, string>;

    logger.info('Search by hashtag request', { tag });

    const result = await this.searchService.searchByHashtag(
      tag,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );

    res.json({
      success: true,
      data: result.hits,
      meta: { total: result.total, took: result.took },
    });
  }

  // ── GET /search/suggest?q=...&type=...&limit=... ─────────────────────────

  async suggest(req: Request, res: Response): Promise<void> {
    const { q, type, limit } = req.query as Record<string, string>;

    const suggestions = await this.autocompleteService.suggest(
      q,
      (type as 'user' | 'hashtag' | 'all') ?? 'all',
      limit ? parseInt(limit, 10) : 10,
    );

    res.json({
      success: true,
      data: suggestions,
    });
  }

  // ── GET /search/trending/hashtags?limit=... ───────────────────────────────

  async getTrendingHashtags(req: Request, res: Response): Promise<void> {
    const { limit } = req.query as Record<string, string>;

    const trending = await this.trendingService.getTopHashtags(
      limit ? parseInt(limit, 10) : undefined,
    );

    res.json({
      success: true,
      data: trending,
    });
  }
}
