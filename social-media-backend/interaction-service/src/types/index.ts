/**
 * TypeScript Type Definitions
 * Interaction Service
 */

export type {
  ApiEnvelope,
  ApiFailure,
  ApiSuccess,
  CursorPage,
  OffsetPage,
  PostDto,
  UserDto,
} from '@social-media/shared';

// ============================================================================
// LIKE TYPES
// ============================================================================

export type { LikeTargetType } from '@social-media/shared';

export interface Like {
  id: string;
  user_id: string;
  target_id: string;
  target_type: LikeTargetType;
  created_at: Date;
}

export interface CreateLikeDto {
  user_id: string;
  target_id: string;
  target_type: LikeTargetType;
}

// ============================================================================
// COMMENT TYPES
// ============================================================================

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  like_count: number;
  depth: number;
  moderation_status: 'APPROVED' | 'REJECTED' | 'PENDING';
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CommentUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
}

export interface CommentWithReplies extends Comment {
  replies_count: number;
  replies?: CommentWithReplies[];
  is_liked: boolean;
  user?: CommentUser;
}

export interface CreateCommentDto {
  post_id: string;
  user_id: string;
  parent_id?: string | null;
  content: string;
}

// ============================================================================
// SHARE TYPES
// ============================================================================

export interface Share {
  id: string;
  user_id: string;
  post_id: string;
  comment: string | null;
  created_at: Date;
}

export interface CreateShareDto {
  user_id: string;
  post_id: string;
  comment?: string;
}

// ============================================================================
// COUNTER TYPES
// ============================================================================

export interface CounterResult {
  count: number;
  source: 'redis' | 'db';
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export type { ApiResponse, PaginatedResponse } from '@social-media/shared';

// ============================================================================
// KAFKA EVENT TYPES
// ============================================================================

export type {
  BaseEvent,
  LikeCreatedEvent,
  LikeDeletedEvent,
  CommentCreatedEvent,
  CommentDeletedEvent,
  ShareCreatedEvent,
  InteractionEvent,
} from '@social-media/shared';

// ============================================================================
// ERROR TYPES
// ============================================================================

import { AppError, LikeTargetType } from '@social-media/shared';

export class InteractionError extends AppError {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(statusCode, code, message);
    this.name = 'InteractionError';
  }
}

export class ValidationError extends InteractionError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends InteractionError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends InteractionError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends InteractionError {
  constructor(message: string = 'Not found') {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends InteractionError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends InteractionError {
  constructor(message: string = 'Too many requests') {
    super('TOO_MANY_REQUESTS', message, 429);
    this.name = 'TooManyRequestsError';
  }
}

// ============================================================================
// REQUEST EXTENSIONS
// ============================================================================

// `Express.Request.user` is augmented centrally in @social-media/shared.



