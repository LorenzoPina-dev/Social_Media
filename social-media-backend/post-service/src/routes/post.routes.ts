/**
 * Post Routes — Validation schemas + router setup
 */

import { Router } from 'express';
import Joi from 'joi';
import { PostController } from '../controllers/post.controller';
import { validateBody, validateQuery, validateParams } from '../middleware/validation';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';
import { createPostLimiter } from '../middleware/rateLimiter';

// ─── Validation Schemas ──────────────────────────────────────────────────────

const uuidParam = Joi.object({ id: Joi.string().uuid().required() });
const userIdParam = Joi.object({ userId: Joi.string().uuid().required() });

const createPostSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required().messages({
    'string.min': 'Content cannot be empty',
    'string.max': 'Content cannot exceed 2000 characters',
    'any.required': 'Content is required',
  }),
  media_urls: Joi.array().items(Joi.string().uri()).max(10).optional(),
  media_types: Joi.array().items(Joi.string().valid('image', 'video')).max(10).optional(),
  visibility: Joi.string().valid('PUBLIC', 'FOLLOWERS', 'PRIVATE').optional().default('PUBLIC'),
  scheduled_at: Joi.string().isoDate().optional(),
});

const updatePostSchema = Joi.object({
  content: Joi.string().min(1).max(2000).optional(),
  visibility: Joi.string().valid('PUBLIC', 'FOLLOWERS', 'PRIVATE').optional(),
}).min(1).messages({ 'object.min': 'At least one field to update is required' });

const listPostsQuery = Joi.object({
  cursor: Joi.string().base64().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

const trendingQuery = Joi.object({
  limit: Joi.number().integer().min(1).max(50).optional(),
});

// ─── Router Setup ────────────────────────────────────────────────────────────

export function setupPostRoutes(postController: PostController): Router {
  const router = Router();

  // Istanza del limiter creata qui — viene chiamata dopo connectRedis() (da setupRoutes → createApp)
  const postLimiter = createPostLimiter();

  // Trending hashtags — prima di /:id per evitare conflitti
  router.get(
    '/trending/hashtags',
    validateQuery(trendingQuery),
    postController.getTrendingHashtags.bind(postController),
  );

  // Create post
  router.post(
    '/',
    requireAuth,
    postLimiter,
    validateBody(createPostSchema),
    postController.create.bind(postController),
  );

  // Get post by ID
  router.get(
    '/:id',
    validateParams(uuidParam),
    optionalAuth,
    postController.getById.bind(postController),
  );

  // Update post
  router.put(
    '/:id',
    requireAuth,
    validateParams(uuidParam),
    validateBody(updatePostSchema),
    postController.update.bind(postController),
  );

  // Delete post
  router.delete(
    '/:id',
    requireAuth,
    validateParams(uuidParam),
    postController.remove.bind(postController),
  );

  // Edit history
  router.get(
    '/:id/history',
    requireAuth,
    validateParams(uuidParam),
    postController.getEditHistory.bind(postController),
  );

  return router;
}

export function setupUserPostRoutes(postController: PostController): Router {
  const router = Router({ mergeParams: true });

  // GET /api/v1/users/:userId/posts
  router.get(
    '/',
    validateParams(userIdParam),
    validateQuery(listPostsQuery),
    optionalAuth,
    postController.listByUser.bind(postController),
  );

  return router;
}
