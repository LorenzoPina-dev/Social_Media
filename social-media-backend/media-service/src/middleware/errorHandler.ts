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

    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  // ── Malformed JSON body ──────────────────────────────────────────────────────
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
    });
    return;
  }

  // ── JWT / jsonwebtoken errors ────────────────────────────────────────────────
  if (err?.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'UNAUTHORIZED',
    });
    return;
  }
  if (err?.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token has expired',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  // ── PostgreSQL / Knex errors ─────────────────────────────────────────────────
  if (isKnexUniqueViolation(err)) {
    logger.warn('Database unique constraint violation', {
      error: err.message,
      constraint: err.constraint,
      url: req.url,
    });
    res.status(409).json({
      success: false,
      error: 'Resource already exists',
      code: 'CONFLICT',
    });
    return;
  }

  if (isKnexForeignKeyViolation(err)) {
    logger.warn('Database foreign key violation', {
      error: err.message,
      url: req.url,
    });
    res.status(422).json({
      success: false,
      error: 'Referenced resource does not exist',
      code: 'UNPROCESSABLE_ENTITY',
    });
    return;
  }

  if (isKnexNotNullViolation(err)) {
    logger.warn('Database not-null constraint violation', {
      error: err.message,
      url: req.url,
    });
    res.status(400).json({
      success: false,
      error: 'Missing required field',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  if (isDatabaseConnectionError(err)) {
    logger.error('Database connection error', {
      error: err.message,
      url: req.url,
    });
    res.status(503).json({
      success: false,
      error: 'Database temporarily unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
    return;
  }

  // ── Payload too large (body-parser) ─────────────────────────────────────────
  if (err?.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: 'Request body too large',
      code: 'PAYLOAD_TOO_LARGE',
    });
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

  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred. Please try again later.',
    code: 'INTERNAL_ERROR',
    ...(isDev && { details: err?.message }),
  });
}

export { AppError };
