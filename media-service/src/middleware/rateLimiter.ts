import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';

export const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT.WINDOW_MS,
  max: config.RATE_LIMIT.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ success: false, error: 'Too many requests', code: 'TOO_MANY_REQUESTS' });
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', { ip: req.ip });
    res.status(429).json({ success: false, error: 'Too many upload requests', code: 'TOO_MANY_REQUESTS' });
  },
});
