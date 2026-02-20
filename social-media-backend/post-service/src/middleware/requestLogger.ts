/**
 * Request Logger Middleware — Post Service
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { postMetrics } from '../utils/metrics';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(duration * 1000),
    });
    postMetrics.httpRequestDuration.observe(
      { method: req.method, endpoint: req.path, status: res.statusCode.toString() },
      duration,
    );
    postMetrics.httpRequestsTotal.inc({
      method: req.method,
      endpoint: req.path,
      status: res.statusCode.toString(),
    });
  });

  next();
}
