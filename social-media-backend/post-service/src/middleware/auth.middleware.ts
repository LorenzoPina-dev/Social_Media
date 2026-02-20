/**
 * Authentication Middleware — Post Service
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
  jti: string;
  iat: number;
  exp: number;
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
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        email: decoded.email,
        verified: decoded.verified,
        mfa_enabled: decoded.mfa_enabled,
      };
      next();
    } catch (jwtError: unknown) {
      const err = jwtError as { name?: string };
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({ success: false, error: 'Token expired', code: 'UNAUTHORIZED' });
        return;
      }
      res.status(401).json({ success: false, error: 'Invalid token', code: 'UNAUTHORIZED' });
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
        const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as JWTPayload;
        req.user = {
          id: decoded.userId,
          username: decoded.username,
          email: decoded.email,
          verified: decoded.verified,
          mfa_enabled: decoded.mfa_enabled,
        };
      } catch {
        // silently fail
      }
    }
    next();
  } catch (error) {
    logger.error('Optional auth error', { error });
    next();
  }
}

export default requireAuth;
