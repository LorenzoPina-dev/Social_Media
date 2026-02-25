/**
 * Validation Middleware
 * Request body validation using Joi
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { fail } from '@social-media/shared';

/**
 * Validate request body against Joi schema
 */
export function validateBody(schema: Joi.Schema) {
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

      logger.warn('Validation failed', { errors, body: req.body });

      fail(res, 400, 'VALIDATION_ERROR', 'Validation failed', errors);
      return;
    }

    // Replace req.body with validated value
    req.body = value;
    next();
  };
}

/**
 * Validate request query parameters against Joi schema
 */
export function validateQuery(schema: Joi.Schema) {
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

      logger.warn('Query validation failed', { errors, query: req.query });

      fail(res, 400, 'VALIDATION_ERROR', 'Validation failed', errors);
      return;
    }

    req.query = value;
    next();
  };
}

/**
 * Validate request params against Joi schema
 */
export function validateParams(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn('Params validation failed', { errors, params: req.params });

      fail(res, 400, 'VALIDATION_ERROR', 'Validation failed', errors);
      return;
    }

    req.params = value;
    next();
  };
}
