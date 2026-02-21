import { Router } from 'express';
import Joi from 'joi';
import { NotificationController } from '../controllers/notification.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateParams, validateQuery } from '../middleware/validation';
import { rateLimiter } from '../middleware/rateLimiter';

const limitedRateLimiter = rateLimiter({ maxRequests: 60 });

const idParamsSchema = Joi.object({ id: Joi.string().uuid().required() });
const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(20),
  cursor: Joi.string().optional(),
});

export function setupNotificationRoutes(controller: NotificationController): Router {
  const router = Router();

  router.use(requireAuth);
  router.use(limitedRateLimiter);

  // GET /api/v1/notifications
  router.get('/', validateQuery(paginationSchema), (req, res) => controller.list(req, res));

  // GET /api/v1/notifications/unread-count
  router.get('/unread-count', (req, res) => controller.unreadCount(req, res));

  // PUT /api/v1/notifications/read-all
  router.put('/read-all', (req, res) => controller.markAllRead(req, res));

  // PUT /api/v1/notifications/:id/read
  router.put('/:id/read', validateParams(idParamsSchema), (req, res) => controller.markRead(req, res));

  return router;
}
