/**
 * TypeScript Type Definitions
 * Interaction Service
 */

// ============================================================================
// LIKE TYPES
// ============================================================================

export type LikeTargetType = 'POST' | 'COMMENT';

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

export interface CommentWithReplies extends Comment {
  replies_count: number;
  replies?: CommentWithReplies[];
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

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    cursor?: string;
    has_more: boolean;
    total?: number;
  };
}

// ============================================================================
// KAFKA EVENT TYPES
// ============================================================================

export interface LikeCreatedEvent {
  type: 'like_created';
  entityId: string; // postId or commentId
  userId: string;
  timestamp: string;
  payload: {
    targetType: LikeTargetType;
    targetId: string;
  };
}

export interface LikeDeletedEvent {
  type: 'like_deleted';
  entityId: string;
  userId: string;
  timestamp: string;
  payload: {
    targetType: LikeTargetType;
    targetId: string;
  };
}

export interface CommentCreatedEvent {
  type: 'comment_created';
  entityId: string; // commentId
  userId: string;
  timestamp: string;
  payload: {
    postId: string;
    parentId: string | null;
    content: string;
  };
}

export interface CommentDeletedEvent {
  type: 'comment_deleted';
  entityId: string; // commentId
  userId: string;
  timestamp: string;
  payload: {
    postId: string;
  };
}

export interface ShareCreatedEvent {
  type: 'share_created';
  entityId: string; // postId
  userId: string;
  timestamp: string;
  payload: {
    shareId: string;
    comment?: string;
  };
}

export type InteractionEvent =
  | LikeCreatedEvent
  | LikeDeletedEvent
  | CommentCreatedEvent
  | CommentDeletedEvent
  | ShareCreatedEvent;

// ============================================================================
// ERROR TYPES
// ============================================================================

export class InteractionError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
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

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username?: string;
      };
    }
  }
}
