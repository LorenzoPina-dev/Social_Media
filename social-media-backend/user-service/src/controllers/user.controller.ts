/**
 * User Controller
 * Handles HTTP requests for user operations
 */

import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { logger } from '../utils/logger';
import { userMetrics } from '../utils/metrics';
import { fail, ok } from '@social-media/shared';

export class UserController {
  constructor(private userService: UserService) {}

  /**
   * Get user by ID
   * GET /api/v1/users/:id
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const { id } = req.params;

    try {
      logger.info('Getting user by ID', { userId: id });

      const user = await this.userService.findById(id);

      if (!user) {
        fail(res, 404, 'NOT_FOUND', `User with ID ${id} does not exist`);
        return;
      }

      // Remove sensitive fields
      const { ...publicUser } = user;

      userMetrics.userRetrieved.inc();
      userMetrics.requestDuration.observe(
        { method: 'GET', endpoint: '/users/:id', status: '200' },
        (Date.now() - startTime) / 1000
      );

      ok(res, publicUser);
    } catch (error) {
      logger.error('Failed to get user', { error, userId: id });
      userMetrics.requestDuration.observe(
        { method: 'GET', endpoint: '/users/:id', status: '500' },
        (Date.now() - startTime) / 1000
      );

      fail(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve user');
    }
  }

  /**
   * Get current user profile
   * GET /api/v1/users/me
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        fail(res, 401, 'UNAUTHORIZED', 'User not authenticated');
        return;
      }

      const user = await this.userService.findById(userId);

      if (!user) {
        fail(res, 404, 'NOT_FOUND', 'User not found');
        return;
      }

      ok(res, user);
    } catch (error) {
      logger.error('Failed to get current user', { error });
      fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  }

  /**
   * Update user profile
   * PUT /api/v1/users/:id
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const updateData = req.body;
    const currentUserId = (req as any).user?.id;

    try {
      // Check authorization
      if (currentUserId !== id) {
        fail(res, 403, 'FORBIDDEN', 'You can only update your own profile');
        return;
      }

      logger.info('Updating user', { userId: id, data: updateData });

      const user = await this.userService.update(id, updateData);

      userMetrics.userUpdated.inc();

      ok(res, user, 'User profile updated successfully');
    } catch (error) {
      logger.error('Failed to update user', { error, userId: id });
      fail(res, 500, 'INTERNAL_ERROR', 'Failed to update user profile');
    }
  }

  /**
   * Delete user account (soft delete)
   * DELETE /api/v1/users/:id
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const currentUserId = (req as any).user?.id;

    try {
      // Check authorization
      if (currentUserId !== id) {
        fail(res, 403, 'FORBIDDEN', 'You can only delete your own account');
        return;
      }

      logger.info('Deleting user', { userId: id });

      await this.userService.softDelete(id);

      userMetrics.userDeleted.inc();

      ok(
        res,
        {
          gracePeriodDays: 30,
          message: 'Your account will be permanently deleted in 30 days',
        },
        'User deletion initiated',
      );
    } catch (error) {
      logger.error('Failed to delete user', { error, userId: id });
      fail(res, 500, 'INTERNAL_ERROR', 'Failed to delete user account');
    }
  }

  /**
   * Search users
   * GET /api/v1/users/search?q=query
   */
  async searchUsers(req: Request, res: Response): Promise<void> {
    const { q: query, verified, limit, offset } = req.query;

    try {
      if (!query || typeof query !== 'string') {
        fail(res, 400, 'BAD_REQUEST', 'Query parameter "q" is required');
        return;
      }

      logger.info('Searching users', { query });

      const options = {
        verified: verified === 'true',
        limit: limit ? parseInt(limit as string, 10) : 20,
        offset: offset ? parseInt(offset as string, 10) : 0,
      };

      const users = await this.userService.search(query, options);

      userMetrics.userSearched.inc();

      ok(res, {
        items: users,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: users.length,
        },
      });
    } catch (error) {
      logger.error('Failed to search users', { error, query });
      fail(res, 500, 'INTERNAL_ERROR', 'Failed to search users');
    }
  }

  /**
   * Get multiple users by IDs
   * POST /api/v1/users/batch
   */
  async getUsersByIds(req: Request, res: Response): Promise<void> {
    const { ids } = req.body;

    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        fail(res, 400, 'BAD_REQUEST', 'Array of user IDs is required');
        return;
      }

      if (ids.length > 100) {
        fail(res, 400, 'BAD_REQUEST', 'Maximum 100 user IDs allowed');
        return;
      }

      const users = await this.userService.findByIds(ids);

      ok(res, users);
    } catch (error) {
      logger.error('Failed to get users by IDs', { error });
      fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  }

  /**
   * Suggested users
   * GET /api/v1/users/suggested
   */
  async getSuggestedUsers(req: Request, res: Response): Promise<void> {
    const { limit } = req.query;
    const currentUserId = (req as any).user?.id;

    try {
      const parsedLimit = limit ? parseInt(limit as string, 10) : 10;
      const users = await this.userService.getSuggestedUsers(parsedLimit, currentUserId);

      ok(res, users);
    } catch (error) {
      logger.error('Failed to get suggested users', { error });
      fail(res, 500, 'INTERNAL_ERROR', 'Failed to load suggested users');
    }
  }

  /**
   * Get privacy settings
   * GET /api/v1/users/:id/privacy
   */
  async getPrivacySettings(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const currentUserId = (req as any).user?.id;

    try {
      if (currentUserId !== id) {
        fail(res, 403, 'FORBIDDEN', 'You can only read your own privacy settings');
        return;
      }

      const settings = await this.userService.getPrivacySettings(id);
      ok(res, settings);
    } catch (error) {
      logger.error('Failed to get privacy settings', { error, userId: id });
      fail(res, 500, 'INTERNAL_ERROR', 'Failed to get privacy settings');
    }
  }

  /**
   * Update privacy settings
   * PUT /api/v1/users/:id/privacy
   */
  async updatePrivacySettings(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const currentUserId = (req as any).user?.id;

    try {
      if (currentUserId !== id) {
        fail(res, 403, 'FORBIDDEN', 'You can only update your own privacy settings');
        return;
      }

      const settings = await this.userService.updatePrivacySettings(id, req.body);
      ok(res, settings);
    } catch (error) {
      logger.error('Failed to update privacy settings', { error, userId: id });
      fail(res, 500, 'INTERNAL_ERROR', 'Failed to update privacy settings');
    }
  }
}
