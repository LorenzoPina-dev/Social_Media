import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { fail } from '@social-media/shared';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      fail(res, 401, 'UNAUTHORIZED', 'Missing token');
      return;
    }

    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as any;
      req.user = payload;
      next();
    } catch (jwtErr: any) {
      if (jwtErr.name === 'TokenExpiredError') {
        fail(res, 401, 'UNAUTHORIZED', 'Token expired');
        return;
      }
      fail(res, 401, 'UNAUTHORIZED', 'Invalid token');
    }
  } catch (error) {
    logger.error('Auth middleware error', { error });
    fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
}

export function optionalAuth(req: Request, _: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), config.JWT_ACCESS_SECRET) as any;
      req.user = payload;
    } catch { /* silent */ }
  }
  next();
}
