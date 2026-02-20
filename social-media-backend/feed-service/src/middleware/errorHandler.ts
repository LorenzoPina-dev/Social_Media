import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { FeedError } from '../types';

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
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
    });
    return;
  }

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
      process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    code: 'INTERNAL_ERROR',
  });
}
