import { Router } from 'express';
import Joi from 'joi';
import { moderationController } from '../controllers/moderation.controller';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validation';

export const moderationRoutes = Router();

// ─── Validation schemas ──────────────────────────────────────────────────────

const reportContentSchema = Joi.object({
  entity_id: Joi.string().uuid().required(),
  entity_type: Joi.string().valid('POST', 'COMMENT', 'MEDIA').required(),
  reason: Joi.string().valid('USER_REPORT').required(),
  content: Joi.string().max(5000).optional(),
  media_urls: Joi.array().items(Joi.string().uri()).max(10).optional(),
});

const resolveDecisionSchema = Joi.object({
  decision: Joi.string().valid('APPROVED', 'REJECTED', 'ESCALATED').required(),
  reason: Joi.string().max(2000).optional(),
});

const statusQuerySchema = Joi.object({
  status: Joi.string().valid('PENDING', 'IN_REVIEW', 'RESOLVED').optional(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

const entityQuerySchema = Joi.object({
  entity_type: Joi.string().valid('POST', 'COMMENT', 'MEDIA').optional(),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// Report content (any authenticated user)
moderationRoutes.post(
  '/report',
  requireAuth,
  validateBody(reportContentSchema),
  moderationController.reportContent.bind(moderationController),
);

// Get case by ID (admin)
moderationRoutes.get(
  '/cases/:id',
  requireAdmin,
  moderationController.getCaseById.bind(moderationController),
);

// Get cases by entity (admin)
moderationRoutes.get(
  '/cases/entity/:entityId',
  requireAdmin,
  validateQuery(entityQuerySchema),
  moderationController.getCasesByEntity.bind(moderationController),
);

// Get cases by status (admin)
moderationRoutes.get(
  '/cases/status/:status',
  requireAdmin,
  validateQuery(statusQuerySchema),
  moderationController.getCasesByStatus.bind(moderationController),
);

// Resolve a case (admin)
moderationRoutes.post(
  '/cases/:id/resolve',
  requireAdmin,
  validateBody(resolveDecisionSchema),
  moderationController.resolveCase.bind(moderationController),
);

// Assign case to self (admin)
moderationRoutes.post(
  '/cases/:id/assign',
  requireAdmin,
  moderationController.assignCase.bind(moderationController),
);
