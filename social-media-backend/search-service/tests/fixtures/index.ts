/**
 * Test Fixtures — factory functions per dati di test del search-service
 */

import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import {
  UserDocument,
  PostDocument,
  HashtagDocument,
  SearchUserResult,
  SearchPostResult,
  TrendingHashtag,
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
  PostCreatedEvent,
  PostUpdatedEvent,
  PostDeletedEvent,
} from '../../src/types';

// ── User Fixtures ─────────────────────────────────────────────────────────────

export const createUserDocument = (overrides: Partial<UserDocument> = {}): UserDocument => ({
  id:             uuidv4(),
  username:       `user_${Math.random().toString(36).slice(2, 8)}`,
  display_name:   'Test User',
  bio:            'A test user bio',
  avatar_url:     'https://cdn.example.com/avatar.jpg',
  verified:       false,
  follower_count: 0,
  status:         'ACTIVE',
  created_at:     new Date().toISOString(),
  ...overrides,
});

export const mockUsers = {
  alice: createUserDocument({
    id: 'alice-uuid-0001',
    username: 'alice_wonder',
    display_name: 'Alice Wonderland',
    bio: 'Developer and coffee lover',
    verified: true,
    follower_count: 1250,
    status: 'ACTIVE',
  }),
  bob: createUserDocument({
    id: 'bob-uuid-0002',
    username: 'bob_builder',
    display_name: 'Bob Builder',
    bio: 'Building things since 1998',
    verified: false,
    follower_count: 42,
    status: 'ACTIVE',
  }),
  suspended: createUserDocument({
    id: 'susp-uuid-0003',
    username: 'suspended_user',
    status: 'SUSPENDED',
    follower_count: 0,
  }),
};

// ── Post Fixtures ─────────────────────────────────────────────────────────────

export const createPostDocument = (overrides: Partial<PostDocument> = {}): PostDocument => ({
  id:                uuidv4(),
  user_id:           uuidv4(),
  content:           'This is a test post with #javascript and #typescript content',
  hashtags:          ['javascript', 'typescript'],
  visibility:        'PUBLIC',
  like_count:        0,
  comment_count:     0,
  moderation_status: 'APPROVED',
  created_at:        new Date().toISOString(),
  ...overrides,
});

export const mockPosts = {
  techPost: createPostDocument({
    id:       'post-uuid-0001',
    user_id:  'alice-uuid-0001',
    content:  'Learning #typescript is amazing! Check out this new feature.',
    hashtags: ['typescript', 'programming'],
    visibility: 'PUBLIC',
    like_count: 42,
    moderation_status: 'APPROVED',
  }),
  privatePost: createPostDocument({
    id:         'post-uuid-0002',
    user_id:    'bob-uuid-0002',
    content:    'This is a private post about #secrets',
    hashtags:   ['secrets'],
    visibility: 'PRIVATE',
  }),
  rejectedPost: createPostDocument({
    id:                'post-uuid-0003',
    user_id:           'bob-uuid-0002',
    content:           'Rejected content',
    hashtags:          [],
    moderation_status: 'REJECTED',
  }),
};

// ── Hashtag Fixtures ──────────────────────────────────────────────────────────

export const createHashtagDocument = (tag: string, postCount = 1): HashtagDocument => ({
  tag,
  post_count: postCount,
  suggest: { input: [tag], weight: postCount },
});

export const mockHashtags: HashtagDocument[] = [
  createHashtagDocument('typescript', 150),
  createHashtagDocument('javascript', 300),
  createHashtagDocument('nodejs', 80),
  createHashtagDocument('programming', 500),
];

// ── Trending Fixtures ─────────────────────────────────────────────────────────

export const mockTrending: TrendingHashtag[] = [
  { tag: 'javascript', score: 300 },
  { tag: 'programming', score: 500 },
  { tag: 'typescript', score: 150 },
];

// ── Search Result Fixtures ────────────────────────────────────────────────────

export const createSearchUserResult = (overrides: Partial<SearchUserResult> = {}): SearchUserResult => ({
  id:             uuidv4(),
  username:       'testuser',
  display_name:   'Test User',
  bio:            'A bio',
  avatar_url:     undefined,
  verified:       false,
  follower_count: 0,
  score:          1.5,
  ...overrides,
});

export const createSearchPostResult = (overrides: Partial<SearchPostResult> = {}): SearchPostResult => ({
  id:            uuidv4(),
  user_id:       uuidv4(),
  content:       'Test post content',
  hashtags:      ['test'],
  like_count:    0,
  comment_count: 0,
  created_at:    new Date().toISOString(),
  score:         1.0,
  ...overrides,
});

// ── Kafka Event Fixtures ──────────────────────────────────────────────────────

export const createUserRegisteredEvent = (overrides: Partial<UserCreatedEvent> = {}): UserCreatedEvent => ({
  type:      'user_registered',
  entityId:  uuidv4(),
  userId:    uuidv4(),
  timestamp: new Date().toISOString(),
  payload: {
    username: 'newuser',
    email:    'newuser@example.com',
  },
  ...overrides,
});

export const createUserUpdatedEvent = (overrides: Partial<UserUpdatedEvent> = {}): UserUpdatedEvent => ({
  type:      'user_updated',
  entityId:  uuidv4(),
  userId:    uuidv4(),
  timestamp: new Date().toISOString(),
  payload: {
    display_name:  'Updated Name',
    changedFields: ['display_name'],
  },
  ...overrides,
});

export const createUserDeletedEvent = (userId: string): UserDeletedEvent => ({
  type:      'user_deleted',
  entityId:  userId,
  userId:    userId,
  timestamp: new Date().toISOString(),
});

export const createPostCreatedEvent = (overrides: Partial<PostCreatedEvent> = {}): PostCreatedEvent => ({
  type:      'post_created',
  entityId:  uuidv4(),
  userId:    uuidv4(),
  timestamp: new Date().toISOString(),
  payload: {
    user_id:           uuidv4(),
    content:           'This is a post with #typescript and #javascript',
    hashtags:          ['typescript', 'javascript'],
    visibility:        'PUBLIC',
    like_count:        0,
    comment_count:     0,
    moderation_status: 'PENDING',
  },
  ...overrides,
});

export const createPostUpdatedEvent = (postId: string, overrides: Partial<PostUpdatedEvent> = {}): PostUpdatedEvent => ({
  type:      'post_updated',
  entityId:  postId,
  userId:    uuidv4(),
  timestamp: new Date().toISOString(),
  payload:   {},
  ...overrides,
});

export const createPostDeletedEvent = (postId: string): PostDeletedEvent => ({
  type:      'post_deleted',
  entityId:  postId,
  userId:    uuidv4(),
  timestamp: new Date().toISOString(),
});

// ── JWT helpers ───────────────────────────────────────────────────────────────

const SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-must-be-at-least-32chars!!';

export function makeJWT(
  userId: string,
  extras: Record<string, unknown> = {},
  options: jwt.SignOptions = {},
): string {
  return jwt.sign(
    { userId, username: `user_${userId.slice(0, 4)}`, email: `${userId.slice(0, 4)}@test.com`, verified: true, mfa_enabled: false, ...extras },
    SECRET,
    { expiresIn: '1h', ...options },
  );
}

export function makeExpiredJWT(userId: string): string {
  return makeJWT(userId, {}, { expiresIn: '-1s' });
}
