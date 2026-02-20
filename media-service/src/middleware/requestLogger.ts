import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('HTTP request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${Date.now() - start}ms`,
      ip: req.ip,
      userId: req.user?.userId,
    });
  });
  next();
}
