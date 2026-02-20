import { Router } from 'express';
import Joi from 'joi';
import { feedController } from '../controllers/feed.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateQuery } from '../middleware/validation';
import { feedRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const feedQuerySchema = Joi.object({
  cursor: Joi.string().base64().optional().allow(''),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

/**
 * GET /api/v1/feed
 * Retrieve authenticated user's personalised feed (cursor-based pagination).
 *
 * Query params:
 *  - cursor  (optional) base64 cursor from previous response
 *  - limit   (optional) 1–50, default 20
 */
router.get(
  '/',
  feedRateLimiter,
  requireAuth,
  validateQuery(feedQuerySchema),
  (req, res, next) => feedController.getMyFeed(req, res, next),
);

/**
 * GET /api/v1/feed/size
 * Returns the total number of entries in the user's feed.
 */
router.get('/size', requireAuth, (req, res, next) =>
  feedController.getFeedSize(req, res, next),
);

/**
 * DELETE /api/v1/feed
 * Clear the user's feed. Useful for testing or account cleanup.
 */
router.delete('/', requireAuth, (req, res, next) =>
  feedController.clearMyFeed(req, res, next),
);

export default router;
