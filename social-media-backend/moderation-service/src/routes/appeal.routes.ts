import { Router } from 'express';
import Joi from 'joi';
import { appealController } from '../controllers/appeal.controller';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validation';

export const appealRoutes = Router();

const createAppealSchema = Joi.object({
  case_id: Joi.string().uuid().required(),
  reason: Joi.string().min(10).max(2000).required(),
});

const resolveAppealSchema = Joi.object({
  status: Joi.string().valid('GRANTED', 'DENIED').required(),
});

const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

// Submit appeal (authenticated user)
appealRoutes.post(
  '/',
  requireAuth,
  validateBody(createAppealSchema),
  appealController.createAppeal.bind(appealController),
);

// Get own appeals (authenticated user)
appealRoutes.get(
  '/my',
  requireAuth,
  validateQuery(paginationSchema),
  appealController.getMyAppeals.bind(appealController),
);

// Get appeal by ID (auth required — owner or admin)
appealRoutes.get(
  '/:id',
  requireAuth,
  appealController.getAppeal.bind(appealController),
);

// Get pending appeals queue (admin)
appealRoutes.get(
  '/',
  requireAdmin,
  validateQuery(paginationSchema),
  appealController.getPendingAppeals.bind(appealController),
);

// Resolve appeal (admin)
appealRoutes.post(
  '/:id/resolve',
  requireAdmin,
  validateBody(resolveAppealSchema),
  appealController.resolveAppeal.bind(appealController),
);
