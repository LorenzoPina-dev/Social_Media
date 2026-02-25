/**
 * Follower Controller
 * Handles follow/unfollow operations
 */

import { Request, Response } from 'express';
import { FollowerService } from '../services/follower.service';
import { logger } from '../utils/logger';
import { userMetrics } from '../utils/metrics';
import { fail, ok } from '@social-media/shared/dist/utils/http';

export class FollowerController {
  constructor(private followerService: FollowerService) {}

  /**
   * Follow a user
   * POST /api/v1/users/:id/follow
   */
  async followUser(req: Request, res: Response): Promise<void> {
    const { id: followingId } = req.params;
    const followerId = (req as any).user?.id;

    try {
      if (!followerId) {
        fail(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        return;
      }

      if (followerId === followingId) {
        fail(res, 400, 'BAD_REQUEST', 'Cannot follow yourself');
        return;
      }

      logger.info('Following user', { followerId, followingId });

      await this.followerService.follow(followerId, followingId);

      userMetrics.userFollowed.inc();

      ok(res, { followed: true }, 'Successfully followed user');
    } catch (error: any) {
      if (error.message === 'User not found') {
        fail(res, 404, 'NOT_FOUND', 'The user you are trying to follow does not exist');
        return;
      }

      if (error.message === 'Already following') {
        fail(res, 400, 'BAD_REQUEST', 'You are already following this user');
        return;
      }

      logger.error('Failed to follow user', { error, followerId, followingId });
      fail(res, 500, 'INTERNAL_ERROR', 'Failed to follow user');
    }
  }

  /**
   * Unfollow a user
   * DELETE /api/v1/users/:id/follow
   */
  async unfollowUser(req: Request, res: Response): Promise<void> {
    const { id: followingId } = req.params;
    const followerId = (req as any).user?.id;

    try {
      if (!followerId) {
        fail(res, 401, 'UNAUTHORIZED', 'Unauthorized');
        return;
      }

      logger.info('Unfollowing user', { followerId, followingId });

      await this.followerService.unfollow(followerId, followingId);

      userMetrics.userUnfollowed.inc();

      ok(res, { unfollowed: true }, 'Successfully unfollowed user');
    } catch (error: any) {
      if (error.message === 'Not following') {
        fail(res, 400, 'BAD_REQUEST', 'You are not following this user');
        return;
      }

      logger.error('Failed to unfollow user', { error, followerId, followingId });
      fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  }

  /**
   * Get user's followers
   * GET /api/v1/users/:id/followers
   */
  async getFollowers(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { limit, offset } = req.query;

    try {
      const options = {
        limit: limit ? parseInt(limit as string, 10) : 20,
        offset: offset ? parseInt(offset as string, 10) : 0,
      };

      const followers = await this.followerService.getFollowers(id, options);

      ok(res, {
        items: followers,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: followers.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get followers', { error, userId: id });
      fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  }

  /**
   * Get users that a user is following
   * GET /api/v1/users/:id/following
   */
  async getFollowing(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { limit, offset } = req.query;

    try {
      const options = {
        limit: limit ? parseInt(limit as string, 10) : 20,
        offset: offset ? parseInt(offset as string, 10) : 0,
      };

      const following = await this.followerService.getFollowing(id, options);

      ok(res, {
        items: following,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: following.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get following', { error, userId: id });
      fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  }

  /**
   * Check if user follows another user
   * GET /api/v1/users/:id/follows/:targetId
   */
  async checkFollowing(req: Request, res: Response): Promise<void> {
    const { id: followerId, targetId: followingId } = req.params;

    try {
      const isFollowing = await this.followerService.isFollowing(followerId, followingId);

      ok(res, { isFollowing });
    } catch (error) {
      logger.error('Failed to check following status', { error });
      fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  }

  /**
   * Get follower statistics
   * GET /api/v1/users/:id/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    try {
      const stats = await this.followerService.getStats(id);

      ok(res, stats);
    } catch (error) {
      logger.error('Failed to get follower stats', { error, userId: id });
      fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  }
}
