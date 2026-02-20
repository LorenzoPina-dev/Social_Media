/**
 * Shared Error Handler Middleware
 * Unified Express error handler that works with the AppError hierarchy.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/api.types';

/**
 * Create an error-handling middleware.
 *
 * @param logger - Optional logger with an `error` method.
 *                 If omitted, errors are written to `console.error`.
 */
export function createErrorHandler(
  logger?: { error: (msg: string, meta?: Record<string, unknown>) => void },
) {
  return function errorHandler(
    error: Error,
    req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    const log = logger ?? { error: console.error };

    log.error('Request error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
    });

    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    // Joi / class-validator style
    if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message,
      code: 'INTERNAL_ERROR',
    });
  };
}
