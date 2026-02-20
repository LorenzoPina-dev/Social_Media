import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Missing token', code: 'UNAUTHORIZED' });
      return;
    }

    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as any;
      req.user = payload;
      next();
    } catch (jwtErr: any) {
      if (jwtErr.name === 'TokenExpiredError') {
        res.status(401).json({ success: false, error: 'Token expired', code: 'UNAUTHORIZED' });
        return;
      }
      res.status(401).json({ success: false, error: 'Invalid token', code: 'UNAUTHORIZED' });
    }
  } catch (error) {
    logger.error('Auth middleware error', { error });
    res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' });
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
