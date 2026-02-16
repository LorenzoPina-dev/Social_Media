/**
 * Error Handler Middleware
 * Centralized error handling
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { AuthError } from '../types';

/**
 * Error handler middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
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
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
    });
    return;
  }

  // Handle Joi validation errors
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.message,
    });
    return;
  }

  // Handle unexpected errors
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    code: 'INTERNAL_ERROR',
  });
}
