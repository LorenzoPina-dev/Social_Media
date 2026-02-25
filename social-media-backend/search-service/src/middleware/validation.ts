/**
 * Validation Middleware — Joi schema validation per query e body
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { fail } from '@social-media/shared';

export function validateQuery(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      logger.warn('Query validation failed', { details });
      fail(res, 400, 'VALIDATION_ERROR', 'Validation failed', details);
      return;
    }

    req.query = value;
    next();
  };
}

export function validateBody(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      logger.warn('Body validation failed', { details });
      fail(res, 400, 'VALIDATION_ERROR', 'Validation failed', details);
      return;
    }

    req.body = value;
    next();
  };
}
