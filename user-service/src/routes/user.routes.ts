/**
 * User Routes
 * HTTP routes for user operations
 */

import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { UserService } from '../services/user.service';
import { UserModel } from '../models/user.model';
import { CacheService } from '../services/cache.service';
import { UserProducer } from '../kafka/producers/user.producer';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// Initialize dependencies
const userModel = new UserModel();
const cacheService = new CacheService();
const userProducer = new UserProducer();
const userService = new UserService(userModel, cacheService, userProducer);
const userController = new UserController(userService);

// Routes
router.get(
  '/me',
  requireAuth,
  userController.getCurrentUser.bind(userController)
);

router.get(
  '/search',
  optionalAuth,
  userController.searchUsers.bind(userController)
);

router.post(
  '/batch',
  requireAuth,
  userController.getUsersByIds.bind(userController)
);

router.get(
  '/:id',
  optionalAuth,
  userController.getUserById.bind(userController)
);

router.put(
  '/:id',
  requireAuth,
  userController.updateUser.bind(userController)
);

router.delete(
  '/:id',
  requireAuth,
  userController.deleteUser.bind(userController)
);

export default router;
