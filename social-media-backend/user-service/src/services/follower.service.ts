/**
 * Follower Service
 * Business logic for follow/unfollow operations
 */

import { FollowerModel } from '../models/follower.model';
import { UserService } from './user.service';
import { CacheService } from './cache.service';
import { UserProducer } from '../kafka/producers/user.producer';
import { logger } from '../utils/logger';
import { User } from '../types';

export class FollowerService {
  constructor(
    private followerModel: FollowerModel,
    private userService: UserService,
    private cacheService: CacheService,
    private userProducer: UserProducer
  ) {}

  /**
   * Follow a user
   */
  async follow(followerId: string, followingId: string): Promise<void> {
    try {
      // Check if user exists
      const userToFollow = await this.userService.findById(followingId);
      if (!userToFollow) {
        throw new Error('User not found');
      }

      // Check if already following
      const isFollowing = await this.followerModel.isFollowing(followerId, followingId);
      if (isFollowing) {
        throw new Error('Already following');
      }

      logger.info('Creating follow relationship', { followerId, followingId });

      // Create follow relationship
      await this.followerModel.create(followerId, followingId);

      // Update counters
      await Promise.all([
        this.userService.incrementFollowerCount(followingId),
        this.userService.incrementFollowingCount(followerId),
      ]);

      // Invalidate caches
      await Promise.all([
        this.cacheService.invalidateFollowers(followerId),
        this.cacheService.invalidateFollowers(followingId),
      ]);

      // Publish event
      await this.userProducer.publishUserFollowed({
        followerId,
        followingId,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to follow user', { error, followerId, followingId });
      throw error;
    }
  }

  /**
   * Unfollow a user
   */
  async unfollow(followerId: string, followingId: string): Promise<void> {
    try {
      // Check if following
      const isFollowing = await this.followerModel.isFollowing(followerId, followingId);
      if (!isFollowing) {
        throw new Error('Not following');
      }

      logger.info('Removing follow relationship', { followerId, followingId });

      // Delete follow relationship
      await this.followerModel.delete(followerId, followingId);

      // Update counters
      await Promise.all([
        this.userService.decrementFollowerCount(followingId),
        this.userService.decrementFollowingCount(followerId),
      ]);

      // Invalidate caches
      await Promise.all([
        this.cacheService.invalidateFollowers(followerId),
        this.cacheService.invalidateFollowers(followingId),
      ]);

      // Publish event
      await this.userProducer.publishUserUnfollowed({
        followerId,
        followingId,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Failed to unfollow user', { error, followerId, followingId });
      throw error;
    }
  }

  /**
   * Get user's followers
   */
  async getFollowers(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<User[]> {
    try {
      // Try cache first
      const cacheKey = `followers:${userId}:${options.limit}:${options.offset}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const followerIds = await this.followerModel.getFollowers(userId, options);
      
      if (followerIds.length === 0) {
        return [];
      }

      // Get user details
      const followers = await this.userService.findByIds(followerIds);

      // Cache results
      await this.cacheService.set(cacheKey, JSON.stringify(followers), 300); // 5 minutes

      return followers;
    } catch (error) {
      logger.error('Failed to get followers', { error, userId });
      throw error;
    }
  }

  /**
   * Get users that a user is following
   */
  async getFollowing(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<User[]> {
    try {
      // Try cache first
      const cacheKey = `following:${userId}:${options.limit}:${options.offset}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const followingIds = await this.followerModel.getFollowing(userId, options);
      
      if (followingIds.length === 0) {
        return [];
      }

      // Get user details
      const following = await this.userService.findByIds(followingIds);

      // Cache results
      await this.cacheService.set(cacheKey, JSON.stringify(following), 300);

      return following;
    } catch (error) {
      logger.error('Failed to get following', { error, userId });
      throw error;
    }
  }

  /**
   * Check if user follows another user
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    try {
      return await this.followerModel.isFollowing(followerId, followingId);
    } catch (error) {
      logger.error('Failed to check following status', { error });
      throw error;
    }
  }

  /**
   * Get follower statistics
   */
  async getStats(userId: string): Promise<{
    followerCount: number;
    followingCount: number;
  }> {
    try {
      const user = await this.userService.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      return {
        followerCount: user.follower_count,
        followingCount: user.following_count,
      };
    } catch (error) {
      logger.error('Failed to get follower stats', { error, userId });
      throw error;
    }
  }

  /**
   * Get ALL follower IDs — no pagination, used by feed-service for fan-out.
   */
  async getFollowerIds(userId: string): Promise<string[]> {
    try {
      return await this.followerModel.getAllFollowerIds(userId);
    } catch (error) {
      logger.error('Failed to get follower IDs', { error, userId });
      throw error;
    }
  }

  /**
   * Remove all followers for a user (used during account deletion)
   */
  async removeAllFollowers(userId: string): Promise<void> {
    try {
      logger.info('Removing all followers', { userId });

      // Get all followers
      const followerIds = await this.followerModel.getFollowers(userId);

      // Delete all follow relationships
      await this.followerModel.deleteAllFollowers(userId);
      await this.followerModel.deleteAllFollowing(userId);

      // Update counters for all affected users
      for (const followerId of followerIds) {
        await this.userService.decrementFollowingCount(followerId);
      }

      // Invalidate caches
      await this.cacheService.invalidateFollowers(userId);
    } catch (error) {
      logger.error('Failed to remove all followers', { error, userId });
      throw error;
    }
  }
}
