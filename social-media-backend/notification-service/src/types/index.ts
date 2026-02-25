/**
 * TypeScript Type Definitions — Notification Service
 */

export type {
  ApiEnvelope,
  ApiFailure,
  ApiSuccess,
  CursorPage,
  OffsetPage,
  NotificationDto,
  UserDto,
} from '@social-media/shared';

// ============================================================================
// DB ENTITIES
// ============================================================================

// Use shared NotificationType for cross-service consistency.
export type { NotificationType } from '@social-media/shared';
export type EntityType = 'POST' | 'COMMENT' | 'USER';
export type Platform = 'IOS' | 'ANDROID' | 'WEB';

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id?: string;
  type: NotificationType;
  entity_id?: string;
  entity_type?: EntityType;
  title: string;
  body: string;
  read: boolean;
  read_at?: Date;
  created_at: Date;
}

export interface NotificationPreferences {
  user_id: string;
  likes_push: boolean;
  likes_email: boolean;
  comments_push: boolean;
  comments_email: boolean;
  follows_push: boolean;
  follows_email: boolean;
  mentions_push: boolean;
  mentions_email: boolean;
  quiet_hours_start?: string;  // HH:MM
  quiet_hours_end?: string;    // HH:MM
  updated_at: Date;
}

export interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: Platform;
  created_at: Date;
  last_used_at: Date;
}

// ============================================================================
// DTOs
// ============================================================================

export interface CreateNotificationDto {
  recipient_id: string;
  actor_id?: string;
  type: NotificationType;
  entity_id?: string;
  entity_type?: EntityType;
  title: string;
  body: string;
}

export interface UpdatePreferencesDto {
  likes_push?: boolean;
  likes_email?: boolean;
  comments_push?: boolean;
  comments_email?: boolean;
  follows_push?: boolean;
  follows_email?: boolean;
  mentions_push?: boolean;
  mentions_email?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
}

export interface RegisterDeviceTokenDto {
  token: string;
  platform: Platform;
}

export interface PaginationQuery {
  cursor?: string;
  limit?: number;
}

// ============================================================================
// KAFKA EVENTS (ricevuti)
// ============================================================================

export interface KafkaBaseEvent {
  type: string;
  entityId: string;
  userId: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

// interaction_events — payload allineati a quelli prodotti da interaction-service
export interface LikeCreatedEvent extends KafkaBaseEvent {
  type: 'like_created';
  payload: {
    targetType: 'POST' | 'COMMENT';
    targetId: string;    // postId o commentId
    postAuthorId?: string; // opzionale: non presente nell'evento base
  };
}

export interface CommentCreatedEvent extends KafkaBaseEvent {
  type: 'comment_created';
  payload: {
    postId: string;
    parentId: string | null;
    content: string;
    postAuthorId?: string;    // opzionale
    parentAuthorId?: string;  // opzionale
  };
}

export interface ShareCreatedEvent extends KafkaBaseEvent {
  type: 'share_created';
  // entityId = postId (vedi interaction-service share.service.ts)
  payload: {
    shareId?: string;
    comment?: string;
    postAuthorId?: string; // opzionale
  };
}

// user_events
export interface FollowCreatedEvent extends KafkaBaseEvent {
  type: 'follow_created';
  payload: { followingId: string };
}

export interface MessageSentEvent extends KafkaBaseEvent {
  type: 'message_sent';
  payload: {
    recipientId: string;
    conversationId: string;
    messageId: string;
    content: string;
  };
}

export interface UserDeletedEvent extends KafkaBaseEvent {
  type: 'user_deleted';
}

// post_events
export interface PostCreatedEvent extends KafkaBaseEvent {
  type: 'post_created';
  payload: { content: string; hashtags: string[]; visibility: string };
}

// moderation_events
export interface ContentRejectedEvent extends KafkaBaseEvent {
  type: 'content_rejected';
  payload: { entityType: string; reason: string; ownerId?: string };
}

export interface ContentApprovedEvent extends KafkaBaseEvent {
  type: 'content_approved';
  payload: { entityType: string; ownerId?: string };
}

export type InteractionEvent = LikeCreatedEvent | CommentCreatedEvent | ShareCreatedEvent;
export type UserEvent = FollowCreatedEvent | MessageSentEvent | UserDeletedEvent;
export type PostEvent = PostCreatedEvent;
export type ModerationEvent = ContentRejectedEvent | ContentApprovedEvent;

// ============================================================================
// API RESPONSE
// ============================================================================

export type { ApiResponse } from '@social-media/shared';

export interface NotificationPaginatedResponse<T> {
  success: true;
  data: T[];
  cursor?: string;
  hasMore: boolean;
}

// ============================================================================
// ERRORS
// ============================================================================

export class NotificationError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}

export class ValidationError extends NotificationError {
  constructor(message: string) { super('VALIDATION_ERROR', message, 400); }
}

export class UnauthorizedError extends NotificationError {
  constructor(message = 'Unauthorized') { super('UNAUTHORIZED', message, 401); }
}

export class ForbiddenError extends NotificationError {
  constructor(message = 'Forbidden') { super('FORBIDDEN', message, 403); }
}

export class NotFoundError extends NotificationError {
  constructor(message = 'Not found') { super('NOT_FOUND', message, 404); }
}

export class TooManyRequestsError extends NotificationError {
  constructor() { super('TOO_MANY_REQUESTS', 'Rate limit exceeded', 429); }
}




