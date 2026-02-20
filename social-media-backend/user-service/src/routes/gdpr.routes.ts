/**
 * GDPR Routes
 * API endpoints for GDPR compliance operations
 */

import { Router } from 'express';
import { GDPRController } from '../controllers/gdpr.controller';
import { requireAuth } from '../middleware/auth.middleware';

/**
 * Setup GDPR routes
 */
export function setupGDPRRoutes(
  gdprController: GDPRController
): Router {
  const router = Router();

  router.get(
    '/:id/export',
    requireAuth,
    gdprController.exportUserData.bind(gdprController)
  );

  router.post(
    '/:id/delete-request',
    requireAuth,
    gdprController.requestDeletion.bind(gdprController)
  );

  router.post(
    '/:id/cancel-deletion',
    requireAuth,
    gdprController.cancelDeletion.bind(gdprController)
  );

  router.get(
    '/:id/data-status',
    requireAuth,
    gdprController.getDataStatus.bind(gdprController)
  );

  return router;
}
