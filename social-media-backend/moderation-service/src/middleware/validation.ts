import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../types';

export function validateBody(schema: Joi.Schema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const message = error.details.map((d) => d.message).join(', ');
      next(new ValidationError(message));
      return;
    }
    next();
  };
}

export function validateQuery(schema: Joi.Schema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, { abortEarly: false });
    if (error) {
      const message = error.details.map((d) => d.message).join(', ');
      next(new ValidationError(message));
      return;
    }
    req.query = value;
    next();
  };
}
