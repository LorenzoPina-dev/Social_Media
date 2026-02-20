/**
 * Request Logger Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
    });

    metrics.recordRequestDuration('http', duration, {
      method: req.method,
      path: req.path,
      statusCode: String(res.statusCode),
    });

    metrics.incrementCounter('http_requests_total', {
      method: req.method,
      path: req.path,
      statusCode: String(res.statusCode),
    });
  });

  next();
}
