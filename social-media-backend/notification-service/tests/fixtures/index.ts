/**
 * Test Fixtures — Factory functions per i test
 */

import { v4 as uuidv4 } from 'uuid';
import { Notification, NotificationPreferences, DeviceToken } from '../../src/types';

export function createNotificationFixture(overrides: Partial<Notification> = {}): Notification {
  return {
    id: uuidv4(),
    recipient_id: uuidv4(),
    actor_id: uuidv4(),
    type: 'LIKE',
    entity_id: uuidv4(),
    entity_type: 'POST',
    title: 'Nuovo like',
    body: 'Qualcuno ha messo like al tuo post',
    read: false,
    read_at: undefined,
    created_at: new Date(),
    ...overrides,
  };
}

export function createPreferencesFixture(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    user_id: uuidv4(),
    likes_push: true,
    likes_email: false,
    comments_push: true,
    comments_email: false,
    follows_push: true,
    follows_email: true,
    mentions_push: true,
    mentions_email: false,
    quiet_hours_start: undefined,
    quiet_hours_end: undefined,
    updated_at: new Date(),
    ...overrides,
  };
}

export function createDeviceTokenFixture(overrides: Partial<DeviceToken> = {}): DeviceToken {
  return {
    id: uuidv4(),
    user_id: uuidv4(),
    token: `fcm-token-${uuidv4()}`,
    platform: 'ANDROID',
    created_at: new Date(),
    last_used_at: new Date(),
    ...overrides,
  };
}

export function createKafkaLikeEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'like_created',
    entityId: uuidv4(),
    userId: uuidv4(),
    timestamp: new Date().toISOString(),
    payload: {
      targetType: 'POST',
      postAuthorId: uuidv4(),
    },
    ...overrides,
  };
}

export function createKafkaFollowEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'follow_created',
    entityId: uuidv4(),
    userId: uuidv4(),
    timestamp: new Date().toISOString(),
    payload: {
      followingId: uuidv4(),
    },
    ...overrides,
  };
}

export function createKafkaCommentEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'comment_created',
    entityId: uuidv4(),
    userId: uuidv4(),
    timestamp: new Date().toISOString(),
    payload: {
      postId: uuidv4(),
      parentId: null,
      postAuthorId: uuidv4(),
    },
    ...overrides,
  };
}
