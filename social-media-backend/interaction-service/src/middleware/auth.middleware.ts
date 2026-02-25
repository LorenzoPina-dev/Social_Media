/**
 * Authentication Middleware
 * Reuses shared auth middleware so that `req.user` has a consistent shape
 * across services, based on `TokenPayload`/`DecodedToken` from
 * `@social-media/shared`.
 */
import { createAuthMiddleware } from '@social-media/shared';
import { config } from '../config';

const { requireAuth, optionalAuth } = createAuthMiddleware(config.JWT.ACCESS_SECRET);

export { requireAuth, optionalAuth };
export default requireAuth;
