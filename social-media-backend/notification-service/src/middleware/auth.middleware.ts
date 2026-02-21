import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

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
      res.status(401).json({ success: false, error: 'No token provided', code: 'UNAUTHORIZED' });
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
      res.status(401).json({ success: false, error: message, code: 'UNAUTHORIZED' });
    }
  } catch (error) {
    logger.error('Authentication error', { error });
    res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
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
