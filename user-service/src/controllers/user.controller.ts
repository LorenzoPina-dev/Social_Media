/**
 * User Controller
 * Handles HTTP requests for user operations
 */

import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { logger } from '../utils/logger';
import { userMetrics } from '../utils/metrics';

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
        res.status(404).json({
          error: 'User not found',
          message: `User with ID ${id} does not exist`,
        });
        return;
      }

      // Remove sensitive fields
      const { ...publicUser } = user;

      userMetrics.userRetrieved.inc();
      userMetrics.requestDuration.observe(
        { method: 'GET', endpoint: '/users/:id', status: '200' },
        (Date.now() - startTime) / 1000
      );

      res.json({
        success: true,
        data: publicUser,
      });
    } catch (error) {
      logger.error('Failed to get user', { error, userId: id });
      userMetrics.requestDuration.observe(
        { method: 'GET', endpoint: '/users/:id', status: '500' },
        (Date.now() - startTime) / 1000
      );

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve user',
      });
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
        res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
        return;
      }

      const user = await this.userService.findById(userId);

      if (!user) {
        res.status(404).json({
          error: 'User not found',
        });
        return;
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logger.error('Failed to get current user', { error });
      res.status(500).json({
        error: 'Internal server error',
      });
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
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only update your own profile',
        });
        return;
      }

      logger.info('Updating user', { userId: id, data: updateData });

      const user = await this.userService.update(id, updateData);

      userMetrics.userUpdated.inc();

      res.json({
        success: true,
        data: user,
        message: 'User profile updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update user', { error, userId: id });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update user profile',
      });
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
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only delete your own account',
        });
        return;
      }

      logger.info('Deleting user', { userId: id });

      await this.userService.softDelete(id);

      userMetrics.userDeleted.inc();

      res.json({
        success: true,
        message: 'User deletion initiated',
        data: {
          gracePeriodDays: 30,
          message: 'Your account will be permanently deleted in 30 days',
        },
      });
    } catch (error) {
      logger.error('Failed to delete user', { error, userId: id });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete user account',
      });
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
        res.status(400).json({
          error: 'Bad request',
          message: 'Query parameter "q" is required',
        });
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

      res.json({
        success: true,
        data: users,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: users.length,
        },
      });
    } catch (error) {
      logger.error('Failed to search users', { error, query });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to search users',
      });
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
        res.status(400).json({
          error: 'Bad request',
          message: 'Array of user IDs is required',
        });
        return;
      }

      if (ids.length > 100) {
        res.status(400).json({
          error: 'Bad request',
          message: 'Maximum 100 user IDs allowed',
        });
        return;
      }

      const users = await this.userService.findByIds(ids);

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      logger.error('Failed to get users by IDs', { error });
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
