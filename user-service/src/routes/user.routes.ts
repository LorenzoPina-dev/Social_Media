/**
 * User Routes
 * API endpoints for user operations
 */

import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { validateBody, validateQuery } from '../middleware/validation';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';

import Joi from 'joi';

/**
 * Validation Schemas
 */

const updateUserSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .optional()
    .messages({
      'string.alphanum': 'Username must contain only letters and numbers',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot exceed 30 characters',
    }),

  display_name: Joi.string()
    .max(100)
    .optional(),

  bio: Joi.string()
    .max(500)
    .optional(),

  avatar_url: Joi.string()
    .uri()
    .optional(),
});

const batchUsersSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one user id is required',
      'any.required': 'Ids are required',
    }),
});

const searchQuerySchema = Joi.object({
  q: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'any.required': 'Search query is required',
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .optional(),
});

/**
 * Setup user routes
 */
export function setupUserRoutes(userController: UserController): Router {
  const router = Router();

  // Get current user
  router.get(
    '/me',
    requireAuth,
    userController.getCurrentUser.bind(userController)
  );

  // Search users
  router.get(
    '/search',
    optionalAuth,
    validateQuery(searchQuerySchema),
    userController.searchUsers.bind(userController)
  );

  // Get users by ids (batch)
  router.post(
    '/batch',
    requireAuth,
    validateBody(batchUsersSchema),
    userController.getUsersByIds.bind(userController)
  );

  // Get user by id
  router.get(
    '/:id',
    optionalAuth,
    userController.getUserById.bind(userController)
  );

  // Update user
  router.put(
    '/:id',
    requireAuth,
    validateBody(updateUserSchema),
    userController.updateUser.bind(userController)
  );

  // Delete user
  router.delete(
    '/:id',
    requireAuth,
    userController.deleteUser.bind(userController)
  );

  return router;
}
