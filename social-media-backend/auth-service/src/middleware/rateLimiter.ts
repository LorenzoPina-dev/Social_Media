/**
 * Rate Limiter Middleware
 * Redis-based rate limiting
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { config } from '../config';
import { fail } from '@social-media/shared';

interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
}

/**
 * Create rate limiter middleware
 */
export function rateLimiter(options: RateLimiterOptions = {}) {
  const {
    windowMs = config.RATE_LIMIT.WINDOW_MS,
    maxRequests = config.RATE_LIMIT.MAX_REQUESTS,
    keyPrefix = 'ratelimit',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedisClient();
      
      // Use IP address as identifier
      const identifier = req.ip || 'unknown';
      const key = `${keyPrefix}:${identifier}`;

      // Get current count
      const current = await redis.get(key);
      const count = current ? parseInt(current, 10) : 0;

      // Check if limit exceeded
      if (count >= maxRequests) {
        const ttl = await redis.ttl(key);
        
        logger.warn('Rate limit exceeded', {
          ip: identifier,
          count,
          limit: maxRequests,
        });

        fail(res, 429, 'RATE_LIMIT_EXCEEDED', 'Too many requests', [
          {
            field: 'retryAfter',
            message: String(ttl > 0 ? ttl : Math.ceil(windowMs / 1000)),
          },
        ]);
        return;
      }

      // Increment counter
      const newCount = await redis.incr(key);

      // Set expiry on first request
      if (newCount === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - newCount).toString());
      
      const ttl = await redis.ttl(key);
      if (ttl > 0) {
        res.setHeader('X-RateLimit-Reset', (Date.now() + ttl * 1000).toString());
      }

      next();
    } catch (error) {
      // If Redis fails, allow the request but log the error
      logger.error('Rate limiter error', { error });
      next();
    }
  };
}

/**
 * Login-specific rate limiter
 */
export const loginRateLimiter = rateLimiter({
  windowMs: config.RATE_LIMIT.LOGIN_WINDOW_MS,
  maxRequests: config.RATE_LIMIT.LOGIN_MAX_ATTEMPTS,
  keyPrefix: 'ratelimit:login',
});
