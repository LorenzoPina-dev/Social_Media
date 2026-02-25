/**
 * Error Handler Middleware — Post Service
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../types';
import { fail } from '@social-media/shared/dist/utils/http';

export function errorHandler(err: Error, req: Request, res: Response, _: NextFunction): void {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  if (err instanceof AppError) {
    fail(res, err.statusCode, err.code, err.message);
    return;
  }

  fail(
    res,
    500,
    'INTERNAL_ERROR',
    'Internal server error',
    process.env.NODE_ENV === 'development' ? [{ message: err.message }] : undefined,
  );
}

export default errorHandler;
