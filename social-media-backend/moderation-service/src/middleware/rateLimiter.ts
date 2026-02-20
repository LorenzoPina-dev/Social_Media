import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
      code: 'TOO_MANY_REQUESTS',
    });
  },
});
