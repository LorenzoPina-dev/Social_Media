/**
 * Auth Middleware — JWT validation (solo lettura, non emette token)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { fail } from '@social-media/shared/dist/utils/http';

interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  verified: boolean;
  mfa_enabled: boolean;
  iat: number;
  exp: number;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      fail(res, 401, 'UNAUTHORIZED', 'Missing token');
      return;
    }

    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as JWTPayload;
      (req as any).user = { id: payload.userId, ...payload };
      next();
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        fail(res, 401, 'UNAUTHORIZED', 'Token expired');
      } else {
        fail(res, 401, 'UNAUTHORIZED', 'Invalid token');
      }
    }
  } catch (error) {
    logger.error('Auth middleware error', { error });
    fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7);
      try {
        const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as JWTPayload;
        (req as any).user = { id: payload.userId, ...payload };
      } catch {
        // silently ignore — optional auth
      }
    }
    next();
  } catch {
    next();
  }
}
