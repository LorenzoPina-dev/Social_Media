/**
 * Types — media-service
 */

export type {
  ApiEnvelope,
  ApiFailure,
  ApiSuccess,
  CursorPage,
  OffsetPage,
  PostDto,
  UserDto,
} from '@social-media/shared/dist/types/contracts.types';

// ─── DB Entities ───────────────────────────────────────────────────────────────

export type MediaStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETED';
export type VirusScanStatus = 'PENDING' | 'CLEAN' | 'INFECTED';
export type JobType = 'IMAGE_RESIZE' | 'VIDEO_TRANSCODE' | 'VIRUS_SCAN';
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface MediaFile {
  id: string;
  user_id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  cdn_url: string | null;
  thumbnail_url: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  status: MediaStatus;
  virus_scan_status: VirusScanStatus;
  created_at: Date;
  processed_at: Date | null;
}

export interface ProcessingJob {
  id: string;
  media_id: string;
  job_type: JobType;
  status: JobStatus;
  error_message: string | null;
  created_at: Date;
  completed_at: Date | null;
}

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface PresignedUploadRequestDto {
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface PresignedUploadResponse {
  media_id: string;
  upload_url: string;
  expires_in: number;
  storage_key: string;
}

export interface ConfirmUploadDto {
  media_id: string;
}

// ─── Kafka Events ──────────────────────────────────────────────────────────────

export interface MediaUploadedEvent {
  type: 'media_uploaded';
  entityId: string;
  userId: string;
  timestamp: string;
  payload: {
    content_type: string;
    size_bytes: number;
    storage_key: string;
  };
}

export interface MediaProcessedEvent {
  type: 'media_processed';
  entityId: string;
  userId: string;
  timestamp: string;
  payload: {
    cdn_url: string;
    thumbnail_url: string | null;
    blurhash: string | null;
    width: number | null;
    height: number | null;
    duration_seconds: number | null;
  };
}

export interface MediaDeletedEvent {
  type: 'media_deleted';
  entityId: string;
  userId: string;
  timestamp: string;
  payload: Record<string, never>;
}

// ─── Errors ────────────────────────────────────────────────────────────────────

/**
 * Base application error.
 *
 * IMPORTANT: AppError calls Object.setPrototypeOf(this, new.target.prototype)
 * using `new.target` so that every subclass automatically gets the correct
 * prototype chain without needing to repeat the call in each subclass.
 * This is the standard fix for "instanceof broken for subclassed built-ins
 * when compiled to ES5" — it works correctly under ES2015+ targets too.
 */

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    // Use new.target so that subclass instances keep their own prototype.
    // Without this, `instanceof ValidationError` would return false.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(msg: string) {
    super(400, 'VALIDATION_ERROR', msg);
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', msg);
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = 'Forbidden') {
    super(403, 'FORBIDDEN', msg);
  }
}

export class NotFoundError extends AppError {
  constructor(msg: string) {
    super(404, 'NOT_FOUND', msg);
  }
}

export class ConflictError extends AppError {
  constructor(msg: string) {
    super(409, 'CONFLICT', msg);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(msg = 'Rate limit exceeded') {
    super(429, 'TOO_MANY_REQUESTS', msg);
  }
}

export class InternalError extends AppError {
  constructor(msg = 'Internal server error') {
    super(500, 'INTERNAL_ERROR', msg);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(msg = 'Service temporarily unavailable') {
    super(503, 'SERVICE_UNAVAILABLE', msg);
  }
}

// ─── Express augmentation ──────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        email: string;
        verified: boolean;
        mfa_enabled: boolean;
        jti: string;
        iat: number;
        exp: number;
      };
    }
  }
}





