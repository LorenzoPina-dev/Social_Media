/**
 * Like Routes
 */

import { Router } from 'express';
import Joi from 'joi';
import { LikeController } from '../controllers/like.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';
import { validateParams } from '../middleware/validation';

const uuidParam = (name: string) =>
  Joi.object({ [name]: Joi.string().uuid().required() });

export function setupLikeRoutes(controller: LikeController): Router {
  const router = Router();

  // POST /api/v1/posts/:postId/like
  router.post(
    '/posts/:postId/like',
    requireAuth,
    validateParams(uuidParam('postId')),
    (req, res) => controller.likePost(req, res)
  );

  // DELETE /api/v1/posts/:postId/like
  router.delete(
    '/posts/:postId/like',
    requireAuth,
    validateParams(uuidParam('postId')),
    (req, res) => controller.unlikePost(req, res)
  );

  // GET /api/v1/posts/:postId/likes/count
  router.get(
    '/posts/:postId/likes/count',
    optionalAuth,
    validateParams(uuidParam('postId')),
    (req, res) => controller.getPostLikeCount(req, res)
  );

  // POST /api/v1/comments/:commentId/like
  router.post(
    '/comments/:commentId/like',
    requireAuth,
    validateParams(uuidParam('commentId')),
    (req, res) => controller.likeComment(req, res)
  );

  // DELETE /api/v1/comments/:commentId/like
  router.delete(
    '/comments/:commentId/like',
    requireAuth,
    validateParams(uuidParam('commentId')),
    (req, res) => controller.unlikeComment(req, res)
  );

  return router;
}
