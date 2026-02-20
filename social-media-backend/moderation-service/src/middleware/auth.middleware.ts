import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { TokenPayload, UnauthorizedError } from '../types';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res
      .status(401)
      .json({ success: false, error: 'Missing or invalid Authorization header', code: 'UNAUTHORIZED' });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
    req.user = payload;
    next();
  } catch {
    res
      .status(401)
      .json({ success: false, error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // TODO: implement actual admin check via user-service or role claim in JWT
  requireAuth(req, res, () => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }
    next();
  });
}
