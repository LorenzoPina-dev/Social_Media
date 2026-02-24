/**
 * @social-media/shared — barrel export
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export * from './types/api.types';
export * from './types/events.types';
export * from './types/auth.types';
export * from './types/contracts.types';

// ─── Utils ───────────────────────────────────────────────────────────────────
export { createLogger } from './utils/logger';
export { encodeCursor, decodeCursor, sanitiseLimit } from './utils/pagination';
export { ok, created, noContent, fail } from './utils/http';
export type { CursorData } from './utils/pagination';

// ─── Middleware ───────────────────────────────────────────────────────────────
export { createAuthMiddleware } from './middleware/auth.middleware';
export { createErrorHandler } from './middleware/errorHandler';
export { createRateLimiter } from './middleware/rateLimiter';
export type { RateLimiterOptions } from './middleware/rateLimiter';

// ─── Database ────────────────────────────────────────────────────────────────
export { createKnexInstance, healthCheck, destroyKnex } from './database/knex.helpers';
export type { DatabaseConfig } from './database/knex.helpers';
