/**
 * Follower Routes
 * API endpoints for follower operations
 */

import { Router } from 'express';
import { FollowerController } from '../controllers/follower.controller';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

/**
 * Setup follower routes
 */
export function setupFollowerRoutes(
  followerController: FollowerController
): Router {
  const router = Router();

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

  return router;
}
