/**
 * Validation Middleware
 * Request validation using Joi
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

/**
 * Validate request body
 */
export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn('Validation error', { errors, body: req.body });

      res.status(400).json({
        error: 'Validation error',
        details: errors,
      });
      return;
    }

    req.body = value;
    next();
  };
}

/**
 * Validate request query parameters
 */
export function validateQuery(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn('Query validation error', { errors, query: req.query });

      res.status(400).json({
        error: 'Validation error',
        details: errors,
      });
      return;
    }

    req.query = value;
    next();
  };
}

/**
 * Validate request params
 */
export function validateParams(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn('Params validation error', { errors, params: req.params });

      res.status(400).json({
        error: 'Validation error',
        details: errors,
      });
      return;
    }

    req.params = value;
    next();
  };
}

// Common validation schemas
export const schemas = {
  uuid: Joi.string().uuid().required(),
  
  updateUser: Joi.object({
    display_name: Joi.string().min(1).max(50).optional(),
    bio: Joi.string().max(500).allow('').optional(),
    avatar_url: Joi.string().uri().optional(),
  }),

  searchQuery: Joi.object({
    q: Joi.string().min(1).max(100).required(),
    verified: Joi.boolean().optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    offset: Joi.number().integer().min(0).optional(),
  }),

  userIds: Joi.object({
    ids: Joi.array().items(Joi.string().uuid()).min(1).max(100).required(),
  }),
};
