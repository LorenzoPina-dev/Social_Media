import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { fail } from '@social-media/shared/dist/utils/http';

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    fail(res, 429, 'TOO_MANY_REQUESTS', 'Too many requests, please try again later');
  },
});
