import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { UnauthorizedError } from '../types';

interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Require a valid Bearer JWT. Attaches req.user on success.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || 'dev-secret',
    ) as JWTPayload;

    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      next(err);
      return;
    }
    if (err.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Token expired'));
      return;
    }
    if (err.name === 'JsonWebTokenError') {
      next(new UnauthorizedError('Invalid token'));
      return;
    }
    logger.error('Authentication error', { err });
    next(new UnauthorizedError('Authentication failed'));
  }
}

/**
 * Attach req.user if a valid token is present, but don't fail if absent.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_ACCESS_SECRET || 'dev-secret',
        ) as JWTPayload;
        req.user = { id: decoded.userId, email: decoded.email };
      } catch {
        // silently ignore
      }
    }
    next();
  } catch (err) {
    logger.error('Optional auth error', { err });
    next();
  }
}
