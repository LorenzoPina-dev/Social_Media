/**
 * User Service
 * Business logic for user operations
 */

import { UserModel } from '../models/user.model';
import { CacheService } from './cache.service';
import { UserProducer } from '../kafka/producers/user.producer';
import { logger } from '../utils/logger';
import { User, CreateUserDto, UpdateUserDto } from '../types';

export class UserService {
  constructor(
    private userModel: UserModel,
    private cacheService: CacheService,
    private userProducer: UserProducer
  ) {}

  /**
   * Find user by ID with caching
   */
  async findById(id: string): Promise<User | null> {
    try {
      // Try cache first
      const cached = await this.cacheService.getUser(id);
      if (cached) {
        logger.debug('User found in cache', { userId: id });
        return cached;
      }

      // Fetch from database
      const user = await this.userModel.findById(id);
      if (user) {
        // Cache for future requests
        await this.cacheService.setUser(user);
      }

      return user;
    } catch (error) {
      logger.error('Failed to find user by ID', { error, userId: id });
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.userModel.findByEmail(email);
    } catch (error) {
      logger.error('Failed to find user by email', { error, email });
      throw error;
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    try {
      return await this.userModel.findByUsername(username);
    } catch (error) {
      logger.error('Failed to find user by username', { error, username });
      throw error;
    }
  }

  /**
   * Create new user
   */
  async create(data: CreateUserDto): Promise<User> {
    try {
      // Check if username already exists
      const existingUsername = await this.userModel.findByUsername(data.username);
      if (existingUsername) {
        throw new Error('Username already exists');
      }

      // Check if email already exists
      const existingEmail = await this.userModel.findByEmail(data.email);
      if (existingEmail) {
        throw new Error('Email already exists');
      }

      logger.info('Creating new user', { username: data.username });

      // Create user
      const user = await this.userModel.create(data);

      // Cache the new user
      await this.cacheService.setUser(user);

      // Publish event
      await this.userProducer.publishUserCreated({
        userId: user.id,
        username: user.username,
        email: user.email,
        timestamp: new Date(),
      });

      return user;
    } catch (error) {
      logger.error('Failed to create user', { error, data });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async update(id: string, data: UpdateUserDto): Promise<User> {
    try {
      logger.info('Updating user', { userId: id, data });

      // Update in database
      const user = await this.userModel.update(id, data);

      // Invalidate cache
      await this.cacheService.deleteUser(id);

      // Publish event
      await this.userProducer.publishUserUpdated({
        userId: id,
        changes: data,
        timestamp: new Date(),
      });

      return user;
    } catch (error) {
      logger.error('Failed to update user', { error, userId: id });
      throw error;
    }
  }

  /**
   * Soft delete user (GDPR compliance)
   */
  async softDelete(id: string): Promise<void> {
    try {
      logger.info('Soft deleting user', { userId: id });

      // Mark as deleted
      await this.userModel.softDelete(id);

      // Invalidate cache
      await this.cacheService.deleteUser(id);

      // Publish deletion event
      await this.userProducer.publishUserDeletionRequested({
        userId: id,
        requestedAt: new Date(),
        gracePeriodDays: 30,
      });
    } catch (error) {
      logger.error('Failed to soft delete user', { error, userId: id });
      throw error;
    }
  }

  /**
   * Hard delete user (permanent)
   */
  async hardDelete(id: string): Promise<void> {
    try {
      logger.info('Hard deleting user', { userId: id });

      // Delete from database
      await this.userModel.hardDelete(id);

      // Invalidate cache
      await this.cacheService.deleteUser(id);

      // Publish event
      await this.userProducer.publishUserDeleted({
        userId: id,
        deletedAt: new Date(),
      });
    } catch (error) {
      logger.error('Failed to hard delete user', { error, userId: id });
      throw error;
    }
  }

  /**
   * Search users
   */
  async search(
    query: string,
    options: {
      verified?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<User[]> {
    try {
      // Try cache first
      const cacheKey = `search:${query}:${JSON.stringify(options)}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Search database
      const users = await this.userModel.search(query, options);

      // Cache results
      await this.cacheService.set(cacheKey, JSON.stringify(users), 600); // 10 minutes

      return users;
    } catch (error) {
      logger.error('Failed to search users', { error, query });
      throw error;
    }
  }

  /**
   * Get multiple users by IDs
   */
  async findByIds(ids: string[]): Promise<User[]> {
    try {
      // Try to get from cache
      const cachedUsers: User[] = [];
      const missingIds: string[] = [];

      for (const id of ids) {
        const cached = await this.cacheService.getUser(id);
        if (cached) {
          cachedUsers.push(cached);
        } else {
          missingIds.push(id);
        }
      }

      // Fetch missing users from database
      if (missingIds.length > 0) {
        const dbUsers = await this.userModel.findByIds(missingIds);

        // Cache fetched users
        for (const user of dbUsers) {
          await this.cacheService.setUser(user);
        }

        return [...cachedUsers, ...dbUsers];
      }

      return cachedUsers;
    } catch (error) {
      logger.error('Failed to find users by IDs', { error, ids });
      throw error;
    }
  }

  /**
   * Increment follower count
   */
  async incrementFollowerCount(id: string): Promise<void> {
    try {
      await this.userModel.incrementFollowerCount(id);
      await this.cacheService.deleteUser(id); // Invalidate cache
    } catch (error) {
      logger.error('Failed to increment follower count', { error, userId: id });
      throw error;
    }
  }

  /**
   * Decrement follower count
   */
  async decrementFollowerCount(id: string): Promise<void> {
    try {
      await this.userModel.decrementFollowerCount(id);
      await this.cacheService.deleteUser(id); // Invalidate cache
    } catch (error) {
      logger.error('Failed to decrement follower count', { error, userId: id });
      throw error;
    }
  }

  /**
   * Increment following count
   */
  async incrementFollowingCount(id: string): Promise<void> {
    try {
      await this.userModel.incrementFollowingCount(id);
      await this.cacheService.deleteUser(id); // Invalidate cache
    } catch (error) {
      logger.error('Failed to increment following count', { error, userId: id });
      throw error;
    }
  }

  /**
   * Decrement following count
   */
  async decrementFollowingCount(id: string): Promise<void> {
    try {
      await this.userModel.decrementFollowingCount(id);
      await this.cacheService.deleteUser(id); // Invalidate cache
    } catch (error) {
      logger.error('Failed to decrement following count', { error, userId: id });
      throw error;
    }
  }
}
