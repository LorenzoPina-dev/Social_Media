/**
 * Request Logger Middleware
 * Logs all incoming HTTP requests
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { userMetrics } from '../utils/metrics';

/**
 * Log incoming requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data): Response {
    const duration = Date.now() - startTime;

    // Log response
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });

    // Record metrics
    userMetrics.requestDuration.observe(
      {
        method: req.method,
        endpoint: req.route?.path || req.path,
        status: res.statusCode.toString(),
      },
      duration / 1000
    );

    userMetrics.requestTotal.inc({
      method: req.method,
      endpoint: req.route?.path || req.path,
      status: res.statusCode.toString(),
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Log errors
 */
export function errorLogger(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    ip: req.ip,
  });

  next(err);
}

export default requestLogger;
