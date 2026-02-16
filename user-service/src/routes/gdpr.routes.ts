/**
 * GDPR Routes
 * HTTP routes for GDPR compliance operations
 */

import { Router } from 'express';
import { GDPRController } from '../controllers/gdpr.controller';
import { GDPRService } from '../services/gdpr.service';
import { UserService } from '../services/user.service';
import { FollowerService } from '../services/follower.service';
import { UserModel } from '../models/user.model';
import { FollowerModel } from '../models/follower.model';
import { CacheService } from '../services/cache.service';
import { UserProducer } from '../kafka/producers/user.producer';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Initialize dependencies
const userModel = new UserModel();
const followerModel = new FollowerModel();
const cacheService = new CacheService();
const userProducer = new UserProducer();
const userService = new UserService(userModel, cacheService, userProducer);
const followerService = new FollowerService(
  followerModel,
  userService,
  cacheService,
  userProducer
);
const gdprService = new GDPRService(userService, followerService, userProducer);
const gdprController = new GDPRController(gdprService);

// Routes
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

export default router;
