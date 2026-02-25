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
 * Search Service — Type Definitions
 */

// ============================================================================
// ELASTICSEARCH DOCUMENT TYPES
// ============================================================================

export interface UserDocument {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  verified: boolean;
  follower_count: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION';
  created_at: string; // ISO8601 per ES
}

export interface PostDocument {
  id: string;
  user_id: string;
  content: string;
  hashtags: string[];
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  like_count: number;
  comment_count: number;
  moderation_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
  created_at: string; // ISO8601 per ES
}

export interface HashtagDocument {
  tag: string;
  post_count: number;
  suggest: {
    input: string[];
    weight: number;
  };
}

// ============================================================================
// SEARCH RESULT TYPES
// ============================================================================

export interface SearchUserResult {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  verified: boolean;
  follower_count: number;
  score: number; // ES _score
}

export interface SearchPostResult {
  id: string;
  user_id: string;
  content: string;
  hashtags: string[];
  like_count: number;
  comment_count: number;
  created_at: string;
  score: number;
}

export interface SearchResult<T> {
  hits: T[];
  total: number;
  took: number; // ms
}

export interface SuggestResult {
  type: 'user' | 'post' | 'hashtag';
  text: string;
  id?: string;
}

export interface TrendingHashtag {
  tag: string;
  score: number; // Redis ZSET score = usage count
}

// ============================================================================
// DTO / QUERY PARAMS
// ============================================================================

export interface SearchUsersDto {
  q: string;
  limit?: number;
  offset?: number;
  verified?: boolean;
}

export interface SearchPostsDto {
  q: string;
  limit?: number;
  offset?: number;
  hashtag?: string;
  from_date?: string;
  to_date?: string;
}

export interface SuggestDto {
  q: string;
  type?: 'user' | 'post' | 'hashtag' | 'all';
  limit?: number;
}

// ============================================================================
// KAFKA EVENT TYPES (consume only)
// ============================================================================

export interface KafkaEvent {
  type: string;
  entityId: string;
  userId: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export interface UserCreatedEvent extends KafkaEvent {
  type: 'user_registered';
  payload: {
    username: string;
    email: string;
  };
}

export interface UserUpdatedEvent extends KafkaEvent {
  type: 'user_updated';
  payload: {
    username?: string;
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    verified?: boolean;
    follower_count?: number;
    changedFields: string[];
  };
}

export interface UserDeletedEvent extends KafkaEvent {
  type: 'user_deleted';
}

export interface PostCreatedEvent extends KafkaEvent {
  type: 'post_created';
  payload: {
    user_id: string;
    content: string;
    hashtags: string[];
    visibility: string;
    like_count: number;
    comment_count: number;
    moderation_status: string;
  };
}

export interface PostUpdatedEvent extends KafkaEvent {
  type: 'post_updated';
  payload: {
    content?: string;
    hashtags?: string[];
    moderation_status?: string;
  };
}

export interface PostDeletedEvent extends KafkaEvent {
  type: 'post_deleted';
}

export type UserEvent = UserCreatedEvent | UserUpdatedEvent | UserDeletedEvent;
export type PostEvent = PostCreatedEvent | PostUpdatedEvent | PostDeletedEvent;

// ============================================================================
// ERROR TYPES
// ============================================================================

export class SearchError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

export class ValidationError extends SearchError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends SearchError {
  constructor(message: string = 'Not found') {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class ElasticsearchError extends SearchError {
  constructor(message: string) {
    super('ELASTICSEARCH_ERROR', message, 503);
    this.name = 'ElasticsearchError';
  }
}

