/**
 * Rate Limiter Middleware
 * Rate limiting with Redis backend
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { fail } from '@social-media/shared/dist/utils/http';

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.WINDOW_MS,
  max: config.RATE_LIMIT.MAX_REQUESTS,
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis store if available
  store: (() => {
    try {
      const redis = getRedisClient();
      return new RedisStore({
        // @ts-ignore
        client: redis,
        prefix: 'rate-limit:api:',
      });
    } catch (error) {
      logger.warn('Redis not available for rate limiting, using memory store');
      return undefined;
    }
  })(),
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    fail(res, 429, 'TOO_MANY_REQUESTS', 'You have exceeded the rate limit. Please try again later.');
  },
});

/**
 * Strict rate limiter for sensitive operations
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    error: 'Too many requests',
    message: 'This action is rate limited. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  store: (() => {
    try {
      const redis = getRedisClient();
      return new RedisStore({
        // @ts-ignore
        client: redis,
        prefix: 'rate-limit:strict:',
      });
    } catch (error) {
      return undefined;
    }
  })(),
  handler: (_req, res) => {
    fail(res, 429, 'TOO_MANY_REQUESTS', 'This action is rate limited. Please try again later.');
  },
});

/**
 * Search rate limiter
 */
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  message: {
    error: 'Too many search requests',
    message: 'Please slow down your search requests.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: (() => {
    try {
      const redis = getRedisClient();
      return new RedisStore({
        // @ts-ignore
        client: redis,
        prefix: 'rate-limit:search:',
      });
    } catch (error) {
      return undefined;
    }
  })(),
  handler: (_req, res) => {
    fail(res, 429, 'TOO_MANY_SEARCH_REQUESTS', 'Please slow down your search requests.');
  },
});

/**
 * Follow/Unfollow rate limiter
 */
export const followLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 follow/unfollow actions per minute
  message: {
    error: 'Too many follow/unfollow requests',
    message: 'Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed requests
  store: (() => {
    try {
      const redis = getRedisClient();
      return new RedisStore({
        // @ts-ignore
        client: redis,
        prefix: 'rate-limit:follow:',
      });
    } catch (error) {
      return undefined;
    }
  })(),
  handler: (_req, res) => {
    fail(res, 429, 'TOO_MANY_FOLLOW_REQUESTS', 'Please slow down.');
  },
});

export default {
  apiLimiter,
  strictLimiter,
  searchLimiter,
  followLimiter,
};
