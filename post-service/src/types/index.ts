/**
 * Post Service — Type Definitions
 *
 * Entities, DTOs, errors, Kafka events
 */

// ─── Entità DB ────────────────────────────────────────────────────────────────

export type PostVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[] | null;
  media_types: string[] | null;
  visibility: PostVisibility;
  like_count: number;
  comment_count: number;
  share_count: number;
  moderation_status: ModerationStatus;
  is_scheduled: boolean;
  scheduled_at: Date | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Hashtag {
  id: string;
  tag: string;
  post_count: number;
  created_at: Date;
}

export interface PostHashtag {
  post_id: string;
  hashtag_id: string;
}

export interface PostEditHistory {
  id: string;
  post_id: string;
  previous_content: string;
  edited_at: Date;
}

// ─── DTO ─────────────────────────────────────────────────────────────────────

export interface CreatePostDto {
  content: string;
  media_urls?: string[];
  media_types?: string[];
  visibility?: PostVisibility;
  scheduled_at?: string;
}

export interface UpdatePostDto {
  content?: string;
  visibility?: PostVisibility;
}

export interface ListPostsQuery {
  cursor?: string;
  limit?: number;
  visibility?: PostVisibility;
}

export interface CursorData {
  id: string;
  created_at: string;
}

// ─── Errori custom ────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor() {
    super(429, 'TOO_MANY_REQUESTS', 'Rate limit exceeded');
  }
}

export class PostNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Post ${id} not found`);
  }
}

export class PostForbiddenError extends ForbiddenError {
  constructor() {
    super('You do not have permission to access or modify this post');
  }
}

// ─── Kafka Events ─────────────────────────────────────────────────────────────

export interface BaseKafkaEvent {
  type: string;
  entityId: string;
  userId: string;
  timestamp: string;
}

export interface PostCreatedEvent extends BaseKafkaEvent {
  type: 'post_created';
  payload: {
    content: string;
    hashtags: string[];
    visibility: PostVisibility;
    moderation_status: ModerationStatus;
  };
}

export interface PostUpdatedEvent extends BaseKafkaEvent {
  type: 'post_updated';
  payload: {
    content?: string;
    visibility?: PostVisibility;
  };
}

export interface PostDeletedEvent extends BaseKafkaEvent {
  type: 'post_deleted';
}

export interface PostScheduledEvent extends BaseKafkaEvent {
  type: 'post_scheduled';
  payload: {
    scheduled_at: string;
  };
}

export interface ModerationStatusUpdatedEvent extends BaseKafkaEvent {
  type: 'post_moderation_updated';
  payload: {
    moderation_status: ModerationStatus;
  };
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedPostsResponse {
  success: true;
  data: Post[];
  cursor?: string;
  hasMore: boolean;
}
