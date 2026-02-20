/**
 * Share Routes
 */

import { Router } from 'express';
import Joi from 'joi';
import { ShareController } from '../controllers/share.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';

const uuidParam = (name: string) =>
  Joi.object({ [name]: Joi.string().uuid().required() });

const shareSchema = Joi.object({
  comment: Joi.string().trim().max(500).optional().allow(null, ''),
});

const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().isoDate().optional(),
});

export function setupShareRoutes(controller: ShareController): Router {
  const router = Router();

  // POST /api/v1/posts/:postId/share
  router.post(
    '/posts/:postId/share',
    requireAuth,
    validateParams(uuidParam('postId')),
    validateBody(shareSchema),
    (req, res) => controller.sharePost(req, res)
  );

  // GET /api/v1/posts/:postId/shares/count
  router.get(
    '/posts/:postId/shares/count',
    validateParams(uuidParam('postId')),
    (req, res) => controller.getShareCount(req, res)
  );

  // GET /api/v1/posts/:postId/shares
  router.get(
    '/posts/:postId/shares',
    validateParams(uuidParam('postId')),
    validateQuery(paginationSchema),
    (req, res) => controller.getSharesByPost(req, res)
  );

  return router;
}
