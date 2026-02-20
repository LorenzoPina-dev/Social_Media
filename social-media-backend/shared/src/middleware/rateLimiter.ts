/**
 * Shared Rate Limiter Factory
 * Creates an express-rate-limit instance with sensible defaults.
 */

import rateLimit, { Options } from 'express-rate-limit';

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: Options['keyGenerator'];
}

/**
 * Create a rate-limiter middleware.
 */
export function createRateLimiter(opts: RateLimiterOptions = {}) {
  return rateLimit({
    windowMs: opts.windowMs ?? 15 * 60 * 1000, // 15 min
    max: opts.max ?? 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: opts.keyGenerator,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: opts.message ?? 'Too many requests',
        code: 'TOO_MANY_REQUESTS',
      });
    },
  });
}
