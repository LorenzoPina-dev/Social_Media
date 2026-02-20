/**
 * Shared Auth Middleware Factory
 * Creates Express middleware that verifies JWT access tokens.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DecodedToken } from '../types/auth.types';

/**
 * Create a `requireAuth` middleware bound to the given JWT secret.
 */
export function createAuthMiddleware(accessSecret: string) {
  function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'No token provided', code: 'UNAUTHORIZED' });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, accessSecret) as DecodedToken;
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        email: decoded.email,
        verified: decoded.verified,
        mfa_enabled: decoded.mfa_enabled,
      };
      next();
    } catch (err: unknown) {
      const jwtErr = err as { name?: string };
      if (jwtErr.name === 'TokenExpiredError') {
        res.status(401).json({ success: false, error: 'Token expired', code: 'UNAUTHORIZED' });
        return;
      }
      res.status(401).json({ success: false, error: 'Invalid token', code: 'UNAUTHORIZED' });
    }
  }

  function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = jwt.verify(token, accessSecret) as DecodedToken;
        req.user = {
          id: decoded.userId,
          username: decoded.username,
          email: decoded.email,
          verified: decoded.verified,
          mfa_enabled: decoded.mfa_enabled,
        };
      } catch {
        // silently fail — user remains undefined
      }
    }
    next();
  }

  return { requireAuth, optionalAuth };
}
