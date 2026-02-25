/**
 * Error Handler Middleware
 * Centralized error handling
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { fail } from '@social-media/shared';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _: NextFunction
): void {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  if (err instanceof AppError) {
    fail(
      res,
      err.statusCode,
      'APP_ERROR',
      err.message,
      process.env.NODE_ENV === 'development' && err.stack
        ? [{ field: 'stack', message: err.stack }]
        : undefined,
    );
    return;
  }

  // Default error
  fail(
    res,
    500,
    'INTERNAL_ERROR',
    'Internal server error',
    process.env.NODE_ENV === 'development'
      ? [
          { field: 'message', message: err.message },
          ...(err.stack ? [{ field: 'stack', message: err.stack }] : []),
        ]
      : undefined,
  );
}

export default errorHandler;
