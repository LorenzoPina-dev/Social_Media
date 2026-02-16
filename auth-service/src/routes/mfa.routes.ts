/**
 * MFA Routes
 * API endpoints for Multi-Factor Authentication
 */

import { Router } from 'express';
import { MFAController } from '../controllers/mfa.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation';
import { rateLimiter } from '../middleware/rateLimiter';
import Joi from 'joi';

const router = Router();

// Validation schemas
const verifyMFASchema = Joi.object({
  code: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      'string.length': 'MFA code must be 6 digits',
      'string.pattern.base': 'MFA code must contain only numbers',
      'any.required': 'MFA code is required',
    }),
});

const disableMFASchema = Joi.object({
  code: Joi.string()
    .required()
    .messages({
      'any.required': 'MFA code is required to disable MFA',
    }),
});

const regenerateCodesSchema = Joi.object({
  code: Joi.string()
    .required()
    .messages({
      'any.required': 'MFA code is required to regenerate backup codes',
    }),
});

/**
 * Setup MFA routes
 */
export function setupMFARoutes(mfaController: MFAController): Router {
  // All MFA routes require authentication
  router.use(requireAuth);

  // Setup MFA (get QR code and secret)
  router.post(
    '/setup',
    rateLimiter({ maxRequests: 3, windowMs: 3600000 }), // 3 requests per hour
    mfaController.setupMFA.bind(mfaController)
  );

  // Verify MFA code and enable
  router.post(
    '/verify',
    rateLimiter({ maxRequests: 5, windowMs: 900000 }), // 5 requests per 15 minutes
    validateBody(verifyMFASchema),
    mfaController.verifyMFA.bind(mfaController)
  );

  // Disable MFA
  router.post(
    '/disable',
    rateLimiter({ maxRequests: 3, windowMs: 3600000 }), // 3 requests per hour
    validateBody(disableMFASchema),
    mfaController.disableMFA.bind(mfaController)
  );

  // Regenerate backup codes
  router.post(
    '/regenerate-codes',
    rateLimiter({ maxRequests: 3, windowMs: 3600000 }), // 3 requests per hour
    validateBody(regenerateCodesSchema),
    mfaController.regenerateBackupCodes.bind(mfaController)
  );

  // Get MFA status
  router.get(
    '/status',
    mfaController.getMFAStatus.bind(mfaController)
  );

  return router;
}
