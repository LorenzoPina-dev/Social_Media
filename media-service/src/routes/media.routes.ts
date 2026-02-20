/**
 * Media Routes — media-service
 *
 * POST   /api/v1/media/upload/presigned   → request presigned URL
 * POST   /api/v1/media/upload/confirm/:id → confirm after direct upload
 * GET    /api/v1/media                    → list authenticated user's media
 * GET    /api/v1/media/:mediaId/status    → get processing status
 * DELETE /api/v1/media/:mediaId           → delete media
 */

import { Router } from 'express';
import Joi from 'joi';
import { UploadController } from '../controllers/upload.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { uploadLimiter } from '../middleware/rateLimiter';

const presignedSchema = Joi.object({
  filename: Joi.string().max(255).required(),
  content_type: Joi.string().max(100).required(),
  size_bytes: Joi.number().integer().min(1).required(),
});

const mediaIdParamSchema = Joi.object({
  mediaId: Joi.string().uuid().required(),
});

const listQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

export function setupMediaRoutes(controller: UploadController): Router {
  const router = Router();

  // POST /upload/presigned — get a presigned URL to upload directly to storage
  router.post(
    '/upload/presigned',
    requireAuth,
    uploadLimiter,
    validateBody(presignedSchema),
    controller.requestPresignedUpload.bind(controller)
  );

  // POST /upload/confirm/:mediaId — confirm the upload is complete
  router.post(
    '/upload/confirm/:mediaId',
    requireAuth,
    validateParams(mediaIdParamSchema),
    controller.confirmUpload.bind(controller)
  );

  // GET / — list user's media files
  router.get(
    '/',
    requireAuth,
    validateQuery(listQuerySchema),
    controller.listUserMedia.bind(controller)
  );

  // GET /:mediaId/status — check processing status
  router.get(
    '/:mediaId/status',
    requireAuth,
    validateParams(mediaIdParamSchema),
    controller.getStatus.bind(controller)
  );

  // DELETE /:mediaId — delete media
  router.delete(
    '/:mediaId',
    requireAuth,
    validateParams(mediaIdParamSchema),
    controller.deleteMedia.bind(controller)
  );

  return router;
}
