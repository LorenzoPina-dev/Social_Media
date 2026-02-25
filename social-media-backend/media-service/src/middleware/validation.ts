import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { fail } from '@social-media/shared/dist/utils/http';

export function validateBody(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const errors = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
      logger.warn('Validation failed', { errors });
      fail(res, 400, 'VALIDATION_ERROR', 'Validation failed', errors);
      return;
    }
    req.body = value;
    next();
  };
}

export function validateParams(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, { abortEarly: false, stripUnknown: true });
    if (error) {
      const errors = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
      fail(res, 400, 'VALIDATION_ERROR', 'Validation failed', errors);
      return;
    }
    req.params = value;
    next();
  };
}

export function validateQuery(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) {
      const errors = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
      fail(res, 400, 'VALIDATION_ERROR', 'Validation failed', errors);
      return;
    }
    req.query = value;
    next();
  };
}
