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
    .allow('')
    .optional(),

  bio: Joi.string()
    .max(500)
    .allow('')
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

const suggestedQuerySchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .optional(),
});

const privacySettingsSchema = Joi.object({
  is_private: Joi.boolean().optional(),
  show_activity_status: Joi.boolean().optional(),
  allow_tagging: Joi.boolean().optional(),
  allow_mentions: Joi.boolean().optional(),
  allow_direct_messages: Joi.string().valid('everyone', 'followers', 'none').optional(),
  blocked_users: Joi.array().items(Joi.string().uuid()).optional(),
  muted_users: Joi.array().items(Joi.string().uuid()).optional(),
  hide_likes_and_views: Joi.boolean().optional(),
  comment_filter: Joi.string().valid('everyone', 'followers', 'none').optional(),
}).min(1);

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

  // Get users by ids (batch) — optionalAuth: used internally by feed-service
  router.post(
    '/batch',
    optionalAuth,
    validateBody(batchUsersSchema),
    userController.getUsersByIds.bind(userController)
  );

  // Suggested users
  router.get(
    '/suggested',
    optionalAuth,
    validateQuery(suggestedQuerySchema),
    userController.getSuggestedUsers.bind(userController)
  );

  // Get privacy settings
  router.get(
    '/:id/privacy',
    requireAuth,
    userController.getPrivacySettings.bind(userController)
  );

  // Update privacy settings
  router.put(
    '/:id/privacy',
    requireAuth,
    validateBody(privacySettingsSchema),
    userController.updatePrivacySettings.bind(userController)
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
