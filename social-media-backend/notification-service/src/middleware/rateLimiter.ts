import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { config } from '../config';

interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
}

export function rateLimiter(options: RateLimiterOptions = {}) {
  const {
    windowMs = config.RATE_LIMIT.WINDOW_MS,
    maxRequests = config.RATE_LIMIT.MAX_REQUESTS,
    keyPrefix = 'ratelimit:notification',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedisClient();
      const identifier = req.ip || 'unknown';
      const key = `${keyPrefix}:${identifier}`;
      const count = parseInt((await redis.get(key)) || '0', 10);

      if (count >= maxRequests) {
        const ttl = await redis.ttl(key);
        logger.warn('Rate limit exceeded', { ip: identifier, count, limit: maxRequests });
        res.status(429).json({
          success: false,
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: ttl > 0 ? ttl : Math.ceil(windowMs / 1000),
        });
        return;
      }

      const newCount = await redis.incr(key);
      if (newCount === 1) await redis.expire(key, Math.ceil(windowMs / 1000));

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - newCount).toString());
      next();
    } catch (error) {
      logger.error('Rate limiter error', { error });
      next();
    }
  };
}
