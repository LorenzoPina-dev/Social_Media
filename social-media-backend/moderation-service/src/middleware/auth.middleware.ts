import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { TokenPayload, UnauthorizedError } from '../types';
import { fail } from '@social-media/shared';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    fail(res, 401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
    req.user = payload;
    next();
  } catch {
    fail(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // TODO: implement actual admin check via user-service or role claim in JWT
  requireAuth(req, res, () => {
    if (!req.user) {
      fail(res, 401, 'UNAUTHORIZED', 'Unauthorized');
      return;
    }
    next();
  });
}
