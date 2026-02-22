/**
 * Search Routes — definisce tutti gli endpoint con validazione Joi
 */

import { Router } from 'express';
import Joi from 'joi';
import { SearchController } from '../controllers/search.controller';
import { validateQuery } from '../middleware/validation';
import { optionalAuth } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rateLimiter';

// ── Validation Schemas ────────────────────────────────────────────────────────

const searchUsersSchema = Joi.object({
  q:        Joi.string().min(1).max(100).required().messages({ 'any.required': 'Query parameter "q" is required' }),
  limit:    Joi.number().integer().min(1).max(100).optional(),
  offset:   Joi.number().integer().min(0).optional(),
  verified: Joi.boolean().optional(),
});

const searchPostsSchema = Joi.object({
  q:         Joi.string().min(1).max(200).required(),
  limit:     Joi.number().integer().min(1).max(100).optional(),
  offset:    Joi.number().integer().min(0).optional(),
  hashtag:   Joi.string().max(100).optional(),
  from_date: Joi.string().isoDate().optional(),
  to_date:   Joi.string().isoDate().optional(),
});

const suggestSchema = Joi.object({
  q:     Joi.string().min(1).max(100).required(),
  type:  Joi.string().valid('user', 'hashtag', 'all').optional(),
  limit: Joi.number().integer().min(1).max(20).optional(),
});

const hashtagQuerySchema = Joi.object({
  limit:  Joi.number().integer().min(1).max(100).optional(),
  offset: Joi.number().integer().min(0).optional(),
});

const trendingSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).optional(),
});

// ── Route factory ─────────────────────────────────────────────────────────────

export function setupSearchRoutes(controller: SearchController): Router {
  const router = Router();

  const defaultLimiter = rateLimiter({ maxRequests: 100, windowMs: 60_000 });
  const suggestLimiter = rateLimiter({ maxRequests: 200, windowMs: 60_000, keyPrefix: 'ratelimit:suggest' });

  /**
   * GET /search/users?q=mario&limit=20&offset=0&verified=true
   * Cerca utenti per username, display_name, bio. Auth opzionale.
   */
  router.get(
    '/users',
    defaultLimiter,
    optionalAuth,
    validateQuery(searchUsersSchema),
    controller.searchUsers.bind(controller),
  );

  /**
   * GET /search/posts?q=testo&hashtag=tech&from_date=2024-01-01&to_date=2024-12-31
   * Full-text search sui post. Solo post PUBLIC e non-REJECTED.
   */
  router.get(
    '/posts',
    defaultLimiter,
    optionalAuth,
    validateQuery(searchPostsSchema),
    controller.searchPosts.bind(controller),
  );

  /**
   * GET /search/hashtag/:tag?limit=20&offset=0
   * Tutti i post con un hashtag specifico.
   */
  router.get(
    '/hashtag/:tag',
    defaultLimiter,
    optionalAuth,
    validateQuery(hashtagQuerySchema),
    controller.searchByHashtag.bind(controller),
  );

  /**
   * GET /search/suggest?q=mar&type=user&limit=10
   * Autocomplete: Redis cache → ES completion suggester.
   */
  router.get(
    '/suggest',
    suggestLimiter,
    validateQuery(suggestSchema),
    controller.suggest.bind(controller),
  );

  /**
   * GET /search/trending/hashtags?limit=20
   * Top hashtag per score (Redis ZSET).
   */
  router.get(
    '/trending/hashtags',
    defaultLimiter,
    validateQuery(trendingSchema),
    controller.getTrendingHashtags.bind(controller),
  );

  return router;
}
