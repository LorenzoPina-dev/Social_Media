import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';
import { logger } from '../utils/logger';
import { fail } from '@social-media/shared/dist/utils/http';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    fail(res, err.statusCode, err.code, err.message);
    return;
  }

  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
}
