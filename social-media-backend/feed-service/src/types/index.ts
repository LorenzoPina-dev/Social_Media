export type {
  ApiEnvelope,
  ApiFailure,
  ApiSuccess,
  CursorPage,
  OffsetPage,
  PostDto,
  UserDto,
} from '@social-media/shared/dist/types/contracts.types';

/**
 * Feed Service — Type Definitions
 */

// ── Kafka events ──────────────────────────────────────────────────────────────

export interface KafkaEvent {
  type: string;
  entityId: string;
  userId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

/** post_events */
export interface PostCreatedPayload {
  userId: string;
  content: string;
  hashtags: string[];
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  media_urls: string[];
  media_types: string[];
  like_count: number;
  comment_count: number;
  share_count: number;
  published_at: string;
  created_at: string;
}

export interface PostDeletedPayload {
  userId: string;
}

export interface PostUpdatedPayload {
  userId: string;
  content?: string;
  visibility?: string;
  media_urls?: string[];
  media_types?: string[];
}

/** interaction_events */
export interface LikeCreatedPayload {
  userId: string;
  targetType: 'POST' | 'COMMENT';
}

export interface ShareCreatedPayload {
  userId: string;
}

export interface CommentCreatedPayload {
  postId: string;
  userId: string;
  parentId?: string;
}

/** user_events */
export interface UserCreatedPayload {
  userId: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  verified?: boolean;
}

export interface UserUpdatedPayload {
  userId: string;
  username?: string;
  display_name?: string;
  avatar_url?: string | null;
  bio?: string;
  verified?: boolean;
}

export interface FollowCreatedPayload {
  followingId: string; // the user being followed
}

export interface FollowDeletedPayload {
  followingId: string;
}

export interface UserDeletedPayload {
  username: string;
}

// ── Feed domain ───────────────────────────────────────────────────────────────

export interface FeedEntry {
  postId: string;
  score: number;
}

export interface FeedItem {
  postId: string;
  score: number;
  /** Populated by hydration via post-service + user-service */
  post?: PostSummary;
}

export interface PostSummary {
  id: string;
  userId: string;
  content: string;
  /** First media item URL (convenience field) */
  imageUrl: string | null;
  /** MIME type / kind of the first media item, e.g. "image" or "video" */
  imageType: string | null;
  /** All media URLs */
  mediaUrls: string[];
  /** Matching type for each mediaUrl */
  mediaTypes: string[];
  visibility: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  /** ISO string — preferred publish timestamp; falls back to createdAt */
  publishedAt: string;
  createdAt: string;
  /** Author profile, populated via user-service */
  author: UserSummary | null;
}

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  verified: boolean;
}

// ── HTTP Response types ───────────────────────────────────────────────────────

export interface PaginatedFeedResponse {
  success: boolean;
  data: {
    items: FeedItem[];
    nextCursor: string | null;
    hasMore: boolean;
    total?: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export class FeedError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);
    this.name = 'FeedError';
  }
}

export class UnauthorizedError extends FeedError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends FeedError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends FeedError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class TooManyRequestsError extends FeedError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

// ── Express augmentation ──────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}
