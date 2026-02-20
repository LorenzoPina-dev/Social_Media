import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const feedRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.WINDOW_MS,
  max: config.RATE_LIMIT.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    code: 'TOO_MANY_REQUESTS',
  },
});
