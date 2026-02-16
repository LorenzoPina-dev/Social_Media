/**
 * Follower Routes
 * HTTP routes for follower operations
 */

import { Router } from 'express';
import { FollowerController } from '../controllers/follower.controller';
import { FollowerService } from '../services/follower.service';
import { FollowerModel } from '../models/follower.model';
import { UserService } from '../services/user.service';
import { UserModel } from '../models/user.model';
import { CacheService } from '../services/cache.service';
import { UserProducer } from '../kafka/producers/user.producer';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

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
const followerController = new FollowerController(followerService);

// Routes
router.post(
  '/:id/follow',
  requireAuth,
  followerController.followUser.bind(followerController)
);

router.delete(
  '/:id/follow',
  requireAuth,
  followerController.unfollowUser.bind(followerController)
);

router.get(
  '/:id/followers',
  optionalAuth,
  followerController.getFollowers.bind(followerController)
);

router.get(
  '/:id/following',
  optionalAuth,
  followerController.getFollowing.bind(followerController)
);

router.get(
  '/:id/follows/:targetId',
  optionalAuth,
  followerController.checkFollowing.bind(followerController)
);

router.get(
  '/:id/stats',
  optionalAuth,
  followerController.getStats.bind(followerController)
);

export default router;
