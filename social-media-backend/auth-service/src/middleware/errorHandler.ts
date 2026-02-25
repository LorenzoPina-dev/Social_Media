/**
 * Error Handler Middleware
 * Centralized error handling
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { AuthError } from '../types';
import { fail } from '@social-media/shared';

/**
 * Error handler middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _: NextFunction
): void {
  // Log error
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Increment error metric
  metrics.incrementCounter('http_errors_total', {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode.toString(),
  });

  // Handle known error types
  if (error instanceof AuthError) {
    fail(res, error.statusCode, error.code, error.message);
    return;
  }

  // Handle Joi validation errors
  if (error.name === 'ValidationError') {
    fail(res, 400, 'VALIDATION_ERROR', 'Validation failed', [{ message: error.message }]);
    return;
  }

  // Handle unexpected errors
  fail(
    res,
    500,
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  );
}
