/**
 * Authentication Middleware
 * JWT token validation
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
//import { config } from '../config';

interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Require authentication
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || 'secret'
      ) as JWTPayload;

      // Attach user to request
      (req as any).user = {
        id: decoded.userId,
        email: decoded.email,
      };

      next();
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Token expired',
        });
        return;
      }

      if (jwtError.name === 'JsonWebTokenError') {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token',
        });
        return;
      }

      throw jwtError;
    }
  } catch (error) {
    logger.error('Authentication error', { error });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}

/**
 * Optional authentication (don't fail if no token)
 */
export function optionalAuth(
  req: Request,
  _: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_ACCESS_SECRET || 'secret'
        ) as JWTPayload;

        (req as any).user = {
          id: decoded.userId,
          email: decoded.email,
        };
      } catch (error) {
        // Silently fail for optional auth
        logger.debug('Optional auth failed', { error });
      }
    }

    next();
  } catch (error) {
    logger.error('Optional authentication error', { error });
    next();
  }
}

export default requireAuth;
