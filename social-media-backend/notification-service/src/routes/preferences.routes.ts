import { Router } from 'express';
import Joi from 'joi';
import { PreferencesController } from '../controllers/preferences.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation';

const updatePreferencesSchema = Joi.object({
  likes_push: Joi.boolean(),
  likes_email: Joi.boolean(),
  comments_push: Joi.boolean(),
  comments_email: Joi.boolean(),
  follows_push: Joi.boolean(),
  follows_email: Joi.boolean(),
  mentions_push: Joi.boolean(),
  mentions_email: Joi.boolean(),
  quiet_hours_start: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).optional().allow(null),
  quiet_hours_end: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).optional().allow(null),
});

export function setupPreferencesRoutes(controller: PreferencesController): Router {
  const router = Router();
  router.use(requireAuth);

  // GET /api/v1/notifications/preferences
  router.get('/', (req, res) => controller.get(req, res));

  // PUT /api/v1/notifications/preferences
  router.put('/', validateBody(updatePreferencesSchema), (req, res) => controller.update(req, res));

  return router;
}
