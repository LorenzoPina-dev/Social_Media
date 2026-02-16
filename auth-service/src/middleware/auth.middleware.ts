/**
 * Auth Middleware
 * JWT token verification and authentication
 */

import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/jwt.service';
import { logger } from '../utils/logger';
import { UnauthorizedError } from '../types';

const jwtService = new JWTService();

/**
 * Require authentication middleware
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = await jwtService.verifyAccessToken(token);

    // Attach user to request (req.user is extended via express.d.ts)
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      verified: decoded.verified,
      mfa_enabled: decoded.mfa_enabled,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(401).json({
        success: false,
        error: error.message,
        code: error.code,
      });
    } else {
      logger.error('Auth middleware error', { error });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}

/**
 * Optional authentication middleware
 */
export async function optionalAuth(
  req: Request,
  _: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = await jwtService.verifyAccessToken(token);
      
      // Attach user to request (req.user is extended via express.d.ts)
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        email: decoded.email,
        verified: decoded.verified,
        mfa_enabled: decoded.mfa_enabled,
      };
    }

    next();
  } catch (error) {
    // For optional auth, we don't return an error
    // Just continue without setting req.user
    next();
  }
}

/**
 * Require verified user middleware
 */
export async function requireVerified(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  if (!req.user.verified) {
    res.status(403).json({
      success: false,
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED',
    });
    return;
  }

  next();
}
