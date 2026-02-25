import { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware } from '@social-media/shared';
import { fail } from '@social-media/shared';
import config from '../config';
import { logger } from '../utils/logger';

const accessSecret = (config as any).JWT?.ACCESS_SECRET ?? (config as any).JWT_ACCESS_SECRET ?? process.env.JWT_ACCESS_SECRET ?? '';
const { requireAuth, optionalAuth } = createAuthMiddleware(accessSecret);

export { requireAuth, optionalAuth };
export default requireAuth;

// keep requireAdmin-like behavior available in services that need it via requireAuth wrapper
