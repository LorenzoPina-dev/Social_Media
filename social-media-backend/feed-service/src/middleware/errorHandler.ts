import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { FeedError } from '../types';
import { fail } from '@social-media/shared/dist/utils/http';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error('Request error', {
    error: error.message,
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    path: req.path,
    method: req.method,
  });

  if (error instanceof FeedError) {
    fail(res, error.statusCode, error.code, error.message);
    return;
  }

  if (error.name === 'ValidationError') {
    fail(res, 400, 'VALIDATION_ERROR', 'Validation failed', [
      { message: error.message },
    ]);
    return;
  }

  fail(
    res,
    500,
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  );
}
