/**
 * Follower Controller
 * Handles follow/unfollow operations
 */

import { Request, Response } from 'express';
import { FollowerService } from '../services/follower.service';
import { logger } from '../utils/logger';
import { userMetrics } from '../utils/metrics';

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
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
        return;
      }

      if (followerId === followingId) {
        res.status(400).json({
          error: 'Bad request',
          message: 'Cannot follow yourself',
        });
        return;
      }

      logger.info('Following user', { followerId, followingId });

      await this.followerService.follow(followerId, followingId);

      userMetrics.userFollowed.inc();

      res.json({
        success: true,
        message: 'Successfully followed user',
      });
    } catch (error: any) {
      if (error.message === 'User not found') {
        res.status(404).json({
          error: 'User not found',
          message: 'The user you are trying to follow does not exist',
        });
        return;
      }

      if (error.message === 'Already following') {
        res.status(400).json({
          error: 'Bad request',
          message: 'You are already following this user',
        });
        return;
      }

      logger.error('Failed to follow user', { error, followerId, followingId });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to follow user',
      });
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
        res.status(401).json({
          error: 'Unauthorized',
        });
        return;
      }

      logger.info('Unfollowing user', { followerId, followingId });

      await this.followerService.unfollow(followerId, followingId);

      userMetrics.userUnfollowed.inc();

      res.json({
        success: true,
        message: 'Successfully unfollowed user',
      });
    } catch (error: any) {
      if (error.message === 'Not following') {
        res.status(400).json({
          error: 'Bad request',
          message: 'You are not following this user',
        });
        return;
      }

      logger.error('Failed to unfollow user', { error, followerId, followingId });
      res.status(500).json({
        error: 'Internal server error',
      });
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

      res.json({
        success: true,
        data: followers,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: followers.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get followers', { error, userId: id });
      res.status(500).json({
        error: 'Internal server error',
      });
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

      res.json({
        success: true,
        data: following,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: following.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get following', { error, userId: id });
      res.status(500).json({
        error: 'Internal server error',
      });
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

      res.json({
        success: true,
        data: {
          isFollowing,
        },
      });
    } catch (error) {
      logger.error('Failed to check following status', { error });
      res.status(500).json({
        error: 'Internal server error',
      });
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

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get follower stats', { error, userId: id });
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
