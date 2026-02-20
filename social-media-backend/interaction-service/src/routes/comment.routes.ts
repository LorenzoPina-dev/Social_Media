/**
 * Comment Routes
 */

import { Router } from 'express';
import Joi from 'joi';
import { CommentController } from '../controllers/comment.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { config } from '../config';

const uuidParam = (name: string) =>
  Joi.object({ [name]: Joi.string().uuid().required() });

const createCommentSchema = Joi.object({
  content: Joi.string().trim().min(1).max(config.BUSINESS.COMMENT_MAX_LENGTH).required(),
  parent_id: Joi.string().uuid().optional().allow(null),
});

const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().isoDate().optional(),
});

export function setupCommentRoutes(controller: CommentController): Router {
  const router = Router();

  // POST /api/v1/posts/:postId/comments
  router.post(
    '/posts/:postId/comments',
    requireAuth,
    validateParams(uuidParam('postId')),
    validateBody(createCommentSchema),
    (req, res) => controller.createComment(req, res)
  );

  // GET /api/v1/posts/:postId/comments
  router.get(
    '/posts/:postId/comments',
    validateParams(uuidParam('postId')),
    validateQuery(paginationSchema),
    (req, res) => controller.getCommentsByPost(req, res)
  );

  // GET /api/v1/comments/:commentId
  router.get(
    '/comments/:commentId',
    validateParams(uuidParam('commentId')),
    (req, res) => controller.getComment(req, res)
  );

  // GET /api/v1/comments/:commentId/replies
  router.get(
    '/comments/:commentId/replies',
    validateParams(uuidParam('commentId')),
    validateQuery(paginationSchema),
    (req, res) => controller.getReplies(req, res)
  );

  // DELETE /api/v1/comments/:commentId
  router.delete(
    '/comments/:commentId',
    requireAuth,
    validateParams(uuidParam('commentId')),
    (req, res) => controller.deleteComment(req, res)
  );

  return router;
}
