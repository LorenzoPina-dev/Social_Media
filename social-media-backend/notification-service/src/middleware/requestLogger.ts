import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  logger.info('Incoming request', { method: req.method, path: req.path, ip: req.ip });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', { method: req.method, path: req.path, statusCode: res.statusCode, duration: `${duration}ms` });
    metrics.recordRequestDuration('http_request', duration);
    metrics.incrementCounter('http_requests_total', { method: req.method, path: req.path, statusCode: res.statusCode.toString() });
  });

  next();
}
