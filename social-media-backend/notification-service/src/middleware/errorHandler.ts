import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { NotificationError } from '../types';
import { fail } from '@social-media/shared';

export function errorHandler(err: Error, req: Request, res: Response, _: NextFunction): void {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  metrics.incrementCounter('http_errors_total', {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode.toString(),
  });

  if (err instanceof NotificationError) {
    fail(res, err.statusCode, err.code, err.message);
    return;
  }

  if (err.name === 'ValidationError') {
    fail(res, 400, 'VALIDATION_ERROR', 'Validation failed', [{ message: err.message }]);
    return;
  }

  fail(
    res,
    500,
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  );
}
