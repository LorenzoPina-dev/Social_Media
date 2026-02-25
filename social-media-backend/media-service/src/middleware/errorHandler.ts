/**
 * Global Error Handler — media-service
 *
 * Catches all errors propagated through Express middleware chain.
 * Provides consistent JSON error responses and structured logging.
 *
 * Error classification:
 *  AppError subclasses  → use their statusCode/code directly
 *  Joi ValidationError  → 400 (from body-parser or manual throws)
 *  SyntaxError          → 400 (malformed JSON body)
 *  Knex errors          → 500 or 409 (unique constraint violations)
 *  Anything else        → 500 INTERNAL_ERROR
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../types';
import { fail } from '@social-media/shared';

// ─── Type guards ──────────────────────────────────────────────────────────────

function isKnexUniqueViolation(err: any): boolean {
  // PostgreSQL unique_violation code
  return err?.code === '23505' || err?.constraint !== undefined;
}

function isKnexForeignKeyViolation(err: any): boolean {
  return err?.code === '23503';
}

function isKnexNotNullViolation(err: any): boolean {
  return err?.code === '23502';
}

function isDatabaseConnectionError(err: any): boolean {
  return (
    err?.code === 'ECONNREFUSED' ||
    err?.code === 'ENOTFOUND' ||
    err?.message?.includes('Connection refused') ||
    err?.message?.includes('getaddrinfo')
  );
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  // ── Already-typed application errors ────────────────────────────────────────
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('Application error', {
        code: err.code,
        message: err.message,
        stack: isDev ? err.stack : undefined,
        url: req.url,
        method: req.method,
      });
    } else {
      logger.warn('Client error', {
        code: err.code,
        message: err.message,
        url: req.url,
        method: req.method,
      });
    }

    fail(res, err.statusCode, err.code, err.message);
    return;
  }

  // ── Malformed JSON body ──────────────────────────────────────────────────────
  if (err instanceof SyntaxError && 'body' in err) {
    fail(res, 400, 'INVALID_JSON', 'Invalid JSON in request body');
    return;
  }

  // ── JWT / jsonwebtoken errors ────────────────────────────────────────────────
  if (err?.name === 'JsonWebTokenError') {
    fail(res, 401, 'UNAUTHORIZED', 'Invalid token');
    return;
  }
  if (err?.name === 'TokenExpiredError') {
    fail(res, 401, 'UNAUTHORIZED', 'Token has expired');
    return;
  }

  // ── PostgreSQL / Knex errors ─────────────────────────────────────────────────
  if (isKnexUniqueViolation(err)) {
    logger.warn('Database unique constraint violation', {
      error: err.message,
      constraint: err.constraint,
      url: req.url,
    });
    fail(res, 409, 'CONFLICT', 'Resource already exists');
    return;
  }

  if (isKnexForeignKeyViolation(err)) {
    logger.warn('Database foreign key violation', {
      error: err.message,
      url: req.url,
    });
    fail(res, 422, 'UNPROCESSABLE_ENTITY', 'Referenced resource does not exist');
    return;
  }

  if (isKnexNotNullViolation(err)) {
    logger.warn('Database not-null constraint violation', {
      error: err.message,
      url: req.url,
    });
    fail(res, 400, 'VALIDATION_ERROR', 'Missing required field');
    return;
  }

  if (isDatabaseConnectionError(err)) {
    logger.error('Database connection error', {
      error: err.message,
      url: req.url,
    });
    fail(res, 503, 'SERVICE_UNAVAILABLE', 'Database temporarily unavailable');
    return;
  }

  // ── Payload too large (body-parser) ─────────────────────────────────────────
  if (err?.type === 'entity.too.large') {
    fail(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
    return;
  }

  // ── Catch-all: unexpected internal error ─────────────────────────────────────
  logger.error('Unhandled error', {
    error: err?.message ?? String(err),
    stack: err?.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.userId,
  });

  fail(
    res,
    500,
    'INTERNAL_ERROR',
    'An unexpected error occurred. Please try again later.',
    isDev ? [{ message: String(err?.message ?? 'Unknown error') }] : undefined,
  );
}

export { AppError };
