/**
 * Authentication Middleware
 * Reuses shared auth middleware so that `req.user` has a consistent shape
 * across services, based on `TokenPayload`/`DecodedToken` from
 * `@social-media/shared`.
 */
import { createAuthMiddleware } from '@social-media/shared';

const { requireAuth, optionalAuth } = createAuthMiddleware(
  process.env.JWT_ACCESS_SECRET || 'secret'
);

export { requireAuth, optionalAuth };
export default requireAuth;
