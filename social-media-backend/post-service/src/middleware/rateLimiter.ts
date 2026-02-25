/**
 * Rate Limiter Middleware — Post Service
 *
 * Implementazione manuale con Redis (stesso stile di auth-service),
 * senza dipendenza da rate-limit-redis. In caso di errore Redis
 * la richiesta viene lasciata passare (fail-open) per garantire disponibilità.
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { fail } from '@social-media/shared/dist/utils/http';

interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
  errorMessage?: string;
  errorCode?: string;
}

/**
 * Factory generica — crea un middleware di rate limiting Redis-based.
 * Chiamare dopo connectRedis() in modo che getRedisClient() funzioni.
 */
function rateLimiter(options: RateLimiterOptions = {}) {
  const {
    windowMs = config.RATE_LIMIT.WINDOW_MS,
    maxRequests = config.RATE_LIMIT.MAX_REQUESTS,
    keyPrefix = 'ratelimit:post-api',
    errorMessage = 'Too many requests',
    errorCode = 'TOO_MANY_REQUESTS',
  } = options;

  // In test environment, skip rate limiting so suites don't interfere
  if (config.NODE_ENV === 'test') {
    return (_req: Request, _res: Response, next: NextFunction): void => next();
  }

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedisClient();
      const identifier = req.ip || 'unknown';
      const key = `${keyPrefix}:${identifier}`;

      const current = await redis.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= maxRequests) {
        const ttl = await redis.ttl(key);
        logger.warn('Rate limit superato', { ip: identifier, count, limit: maxRequests, prefix: keyPrefix });
        fail(res, 429, errorCode, errorMessage, [
          {
            field: 'retryAfter',
            message: String(ttl > 0 ? ttl : Math.ceil(windowMs / 1000)),
          },
        ]);
        return;
      }

      const newCount = await redis.incr(key);

      // Imposta la scadenza solo al primo incremento
      if (newCount === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      // Standard rate-limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - newCount).toString());
      const ttl = await redis.ttl(key);
      if (ttl > 0) {
        res.setHeader('X-RateLimit-Reset', (Date.now() + ttl * 1000).toString());
      }

      next();
    } catch (error) {
      // Se Redis non è disponibile, fail-open: la richiesta passa
      logger.error('Rate limiter error — fail-open', { error });
      next();
    }
  };
}

/**
 * Rate limiter globale per tutte le API (15 min / 100 req).
 */
export function createApiLimiter() {
  return rateLimiter({
    windowMs: config.RATE_LIMIT.WINDOW_MS,
    maxRequests: config.RATE_LIMIT.MAX_REQUESTS,
    keyPrefix: 'ratelimit:post-api',
    errorMessage: 'Too many requests',
    errorCode: 'TOO_MANY_REQUESTS',
  });
}

/**
 * Rate limiter per la creazione di post (1 min / 10 post).
 */
export function createPostLimiter() {
  return rateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'ratelimit:create-post',
    errorMessage: 'Too many posts created',
    errorCode: 'TOO_MANY_REQUESTS',
  });
}
