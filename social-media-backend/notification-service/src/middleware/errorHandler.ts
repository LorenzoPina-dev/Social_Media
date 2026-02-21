import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { NotificationError } from '../types';

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
    res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
    return;
  }

  if (err.name === 'ValidationError') {
    res.status(400).json({ success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: err.message });
    return;
  }

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
  });
}
