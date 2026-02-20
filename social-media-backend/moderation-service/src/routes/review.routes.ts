import { Router } from 'express';
import Joi from 'joi';
import { reviewController } from '../controllers/review.controller';
import { requireAdmin } from '../middleware/auth.middleware';
import { validateQuery } from '../middleware/validation';

export const reviewRoutes = Router();

const queueQuerySchema = Joi.object({
  status: Joi.string().valid('PENDING', 'IN_REVIEW', 'RESOLVED').default('PENDING'),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

// Get moderation queue (admin)
reviewRoutes.get(
  '/queue',
  requireAdmin,
  validateQuery(queueQuerySchema),
  reviewController.getQueue.bind(reviewController),
);

// Get case details + decisions (admin)
reviewRoutes.get(
  '/cases/:id',
  requireAdmin,
  reviewController.getCaseDetails.bind(reviewController),
);

// Get queue stats (admin)
reviewRoutes.get(
  '/stats',
  requireAdmin,
  reviewController.getStats.bind(reviewController),
);
