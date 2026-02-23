/**
 * Auth Middleware — JWT validation (solo lettura, non emette token)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

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
      res.status(401).json({ success: false, error: 'Missing token', code: 'UNAUTHORIZED' });
      return;
    }

    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as JWTPayload;
      (req as any).user = { id: payload.userId, ...payload };
      next();
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({ success: false, error: 'Token expired', code: 'UNAUTHORIZED' });
      } else {
        res.status(401).json({ success: false, error: 'Invalid token', code: 'UNAUTHORIZED' });
      }
    }
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
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
