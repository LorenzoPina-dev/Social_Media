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
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      fail(res, 401, 'UNAUTHORIZED', 'No token provided');
      return;
    }
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as JWTPayload;
      req.user = decoded;
      next();
    } catch (jwtError: unknown) {
      const err = jwtError as Error;
      const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
      fail(res, 401, 'UNAUTHORIZED', message);
    }
  } catch (error) {
    logger.error('Authentication error', { error });
    fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
}

export function optionalAuth(req: Request, _: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        req.user = jwt.verify(token, config.JWT_ACCESS_SECRET) as JWTPayload;
      } catch {
        // Silently ignore
      }
    }
    next();
  } catch (error) {
    logger.debug('Optional auth failed', { error });
    next();
  }
}
