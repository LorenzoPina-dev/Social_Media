import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { fail } from '@social-media/shared/dist/utils/http';

export function validateQuery(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) {
      fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        error.details.map((d) => ({ message: d.message })),
      );
      return;
    }
    req.query = value;
    next();
  };
}

export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Validation failed',
        error.details.map((d) => ({ message: d.message })),
      );
      return;
    }
    req.body = value;
    next();
  };
}
