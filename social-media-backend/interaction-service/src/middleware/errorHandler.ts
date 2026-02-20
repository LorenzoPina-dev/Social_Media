/**
 * Centralized Error Handler
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { InteractionError } from '../types';

export function errorHandler(error: Error, req: Request, res: Response, _: NextFunction): void {
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  metrics.incrementCounter('http_errors_total', {
    method: req.method,
    path: req.path,
    statusCode: String((error as InteractionError).statusCode || 500),
  });

  if (error instanceof InteractionError) {
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
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    code: 'INTERNAL_ERROR',
  });
}
