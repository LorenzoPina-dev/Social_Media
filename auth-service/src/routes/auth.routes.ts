/**
 * Auth Routes
 * API endpoints for authentication
 */

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validation';
import { rateLimiter } from '../middleware/rateLimiter';
import { requireAuth } from '../middleware/auth.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only letters and numbers',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot exceed 30 characters',
      'any.required': 'Username is required',
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required',
    }),
  password: Joi.string()
    .min(8)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'any.required': 'Password is required',
    }),
  display_name: Joi.string()
    .max(100)
    .optional(),
});

const loginSchema = Joi.object({
  username: Joi.string()
    .required()
    .messages({
      'any.required': 'Username is required',
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required',
    }),
  mfa_code: Joi.string()
    .length(6)
    .optional()
    .messages({
      'string.length': 'MFA code must be 6 digits',
    }),
});

const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token is required',
    }),
});

/**
 * Setup auth routes
 */
export function setupAuthRoutes(authController: AuthController): Router {
  // Register
  router.post(
    '/register',
    rateLimiter({ maxRequests: 10, windowMs: 900000 }), // 10 requests per 15 minutes
    validateBody(registerSchema),
    authController.register.bind(authController)
  );

  // Login
  router.post(
    '/login',
    rateLimiter({ maxRequests: 5, windowMs: 900000 }), // 5 requests per 15 minutes
    validateBody(loginSchema),
    authController.login.bind(authController)
  );

  // Refresh token
  router.post(
    '/refresh',
    rateLimiter({ maxRequests: 20, windowMs: 900000 }),
    validateBody(refreshTokenSchema),
    authController.refreshToken.bind(authController)
  );

  // Logout
  router.post(
    '/logout',
    validateBody(refreshTokenSchema),
    authController.logout.bind(authController)
  );

  // Logout all
  router.post(
    '/logout-all',
    requireAuth,
    authController.logoutAll.bind(authController)
  );

  return router;
}
