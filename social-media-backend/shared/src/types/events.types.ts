/**
 * Shared Kafka Event Types
 * Canonical event contracts used across all microservices.
 */

// ─── Base Event ──────────────────────────────────────────────────────────────

export interface BaseEvent {
  type: string;
  entityId: string;
  userId: string;
  timestamp: string;
}

// ─── User Events (topic: user_events) ────────────────────────────────────────

export interface UserRegisteredEvent extends BaseEvent {
  type: 'user_registered';
  payload: {
    username: string;
    email: string;
    display_name?: string;
  };
}

export interface UserUpdatedEvent extends BaseEvent {
  type: 'user_updated';
  payload: {
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface UserDeletedEvent extends BaseEvent {
  type: 'user_deleted';
}

export type UserEvent = UserRegisteredEvent | UserUpdatedEvent | UserDeletedEvent;

// ─── Auth Events (topic: auth_events) ────────────────────────────────────────

export interface UserAuthenticatedEvent extends BaseEvent {
  type: 'user_authenticated';
  payload: {
    ip_address?: string;
    device_info?: string;
  };
}

export interface PasswordChangedEvent extends BaseEvent {
  type: 'password_changed';
}

export interface MFAEnabledEvent extends BaseEvent {
  type: 'mfa_enabled';
}

export interface SuspiciousLoginEvent extends BaseEvent {
  type: 'suspicious_login';
  payload: {
    ip_address: string;
    reason: string;
  };
}

export type AuthEvent =
  | UserAuthenticatedEvent
  | PasswordChangedEvent
  | MFAEnabledEvent
  | SuspiciousLoginEvent;

// ─── Post Events (topic: post_events) ────────────────────────────────────────

export type PostVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';

export interface PostCreatedEvent extends BaseEvent {
  type: 'post_created';
  payload: {
    content: string;
    hashtags: string[];
    visibility: PostVisibility;
    moderation_status: ModerationStatus;
  };
}

export interface PostUpdatedEvent extends BaseEvent {
  type: 'post_updated';
  payload: {
    content?: string;
    visibility?: PostVisibility;
  };
}

export interface PostDeletedEvent extends BaseEvent {
  type: 'post_deleted';
}

export interface PostModerationUpdatedEvent extends BaseEvent {
  type: 'post_moderation_updated';
  payload: {
    moderation_status: ModerationStatus;
  };
}

export type PostEvent =
  | PostCreatedEvent
  | PostUpdatedEvent
  | PostDeletedEvent
  | PostModerationUpdatedEvent;

// ─── Interaction Events (topic: interaction_events) ──────────────────────────

export type LikeTargetType = 'POST' | 'COMMENT';

export interface LikeCreatedEvent extends BaseEvent {
  type: 'like_created';
  payload: {
    targetType: LikeTargetType;
    targetId: string;
  };
}

export interface LikeDeletedEvent extends BaseEvent {
  type: 'like_deleted';
  payload: {
    targetType: LikeTargetType;
    targetId: string;
  };
}

export interface CommentCreatedEvent extends BaseEvent {
  type: 'comment_created';
  payload: {
    postId: string;
    parentId: string | null;
    content: string;
  };
}

export interface CommentDeletedEvent extends BaseEvent {
  type: 'comment_deleted';
  payload: {
    postId: string;
  };
}

export interface ShareCreatedEvent extends BaseEvent {
  type: 'share_created';
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

// ─── Notification Events (topic: notification_events) ────────────────────────

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'mention'
  | 'share'
  | 'system';

export interface NotificationEvent extends BaseEvent {
  type: 'notification_created';
  payload: {
    recipientId: string;
    notificationType: NotificationType;
    title: string;
    body: string;
    resourceId?: string;
    resourceType?: string;
  };
}

// ─── Moderation Events (topic: moderation_events) ────────────────────────────

export interface ModerationDecisionEvent extends BaseEvent {
  type: 'moderation_decision';
  payload: {
    targetType: 'post' | 'comment' | 'user';
    targetId: string;
    decision: ModerationStatus;
    reason?: string;
  };
}
