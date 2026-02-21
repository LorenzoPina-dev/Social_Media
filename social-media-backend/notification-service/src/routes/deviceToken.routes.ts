import { Router } from 'express';
import Joi from 'joi';
import { DeviceTokenController } from '../controllers/deviceToken.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validation';

const registerSchema = Joi.object({
  token: Joi.string().max(500).required(),
  platform: Joi.string().valid('IOS', 'ANDROID', 'WEB').required(),
});

const tokenParamsSchema = Joi.object({
  token: Joi.string().max(500).required(),
});

export function setupDeviceTokenRoutes(controller: DeviceTokenController): Router {
  const router = Router();
  router.use(requireAuth);

  // POST /api/v1/notifications/devices
  router.post('/', validateBody(registerSchema), (req, res) => controller.register(req, res));

  // GET /api/v1/notifications/devices
  router.get('/', (req, res) => controller.list(req, res));

  // DELETE /api/v1/notifications/devices/:token
  router.delete('/:token', validateParams(tokenParamsSchema), (req, res) => controller.unregister(req, res));

  return router;
}
