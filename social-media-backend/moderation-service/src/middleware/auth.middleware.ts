import { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware } from '@social-media/shared';
import { fail } from '@social-media/shared';
import {config} from '../config';

const accessSecret = (config as any).JWT?.ACCESS_SECRET ?? (config as any).JWT_ACCESS_SECRET ?? (config as any).jwt?.accessSecret ?? process.env.JWT_ACCESS_SECRET ?? '';
const { requireAuth, optionalAuth } = createAuthMiddleware(accessSecret);

export { requireAuth, optionalAuth };
export default requireAuth;

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user) {
      fail(res, 401, 'UNAUTHORIZED', 'Unauthorized');
      return;
    }
    next();
  });
}
