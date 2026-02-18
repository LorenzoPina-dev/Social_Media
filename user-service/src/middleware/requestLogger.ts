/**
 * Request Logger Middleware
 * Logs all HTTP requests
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

/**
 * Request logger middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Hook into response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log response
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });

    // Record metrics
    metrics.recordRequestDuration('http_request', duration);
    metrics.incrementCounter('http_requests_total', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode.toString(),
    });
  });

  next();
}
