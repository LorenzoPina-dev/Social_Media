/**
 * Rate Limiter — Redis sliding window
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { fail } from '@social-media/shared';

interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
}

export function rateLimiter(options: RateLimiterOptions = {}) {
  const {
    windowMs = config.RATE_LIMIT.WINDOW_MS,
    maxRequests = config.RATE_LIMIT.MAX_REQUESTS,
    keyPrefix = 'ratelimit:search',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedisClient();
      const identifier = req.ip ?? 'unknown';
      const key = `${keyPrefix}:${identifier}`;

      const current = await redis.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= maxRequests) {
        const ttl = await redis.ttl(key);
        fail(res, 429, 'RATE_LIMIT_EXCEEDED', 'Too many requests', [
          {
            field: 'retryAfter',
            message: String(ttl > 0 ? ttl : Math.ceil(windowMs / 1000)),
          },
        ]);
        return;
      }

      const newCount = await redis.incr(key);
      if (newCount === 1) await redis.expire(key, Math.ceil(windowMs / 1000));

      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - newCount)));

      next();
    } catch (error) {
      logger.error('Rate limiter error', { error });
      next(); // fail open
    }
  };
}
