/**
 * Test fixtures for feed-service
 */
import { v4 as uuidv4 } from 'uuid';

export const createUserId = (): string => uuidv4();
export const createPostId = (): string => uuidv4();

export const createKafkaPostCreatedEvent = (overrides: Record<string, unknown> = {}) => ({
  type: 'post_created',
  entityId: createPostId(),
  userId: createUserId(),
  timestamp: new Date().toISOString(),
  payload: {
    userId: createUserId(),
    content: 'Test post #hashtag',
    hashtags: ['hashtag'],
    visibility: 'PUBLIC',
  },
  ...overrides,
});

export const createKafkaPostDeletedEvent = (overrides: Record<string, unknown> = {}) => ({
  type: 'post_deleted',
  entityId: createPostId(),
  userId: createUserId(),
  timestamp: new Date().toISOString(),
  payload: { userId: createUserId() },
  ...overrides,
});

export const createKafkaLikeCreatedEvent = (overrides: Record<string, unknown> = {}) => ({
  type: 'like_created',
  entityId: createPostId(),
  userId: createUserId(),
  timestamp: new Date().toISOString(),
  payload: { userId: createUserId(), targetType: 'POST' },
  ...overrides,
});

export const createKafkaFollowCreatedEvent = (overrides: Record<string, unknown> = {}) => ({
  type: 'follow_created',
  entityId: createUserId(),
  userId: createUserId(),
  timestamp: new Date().toISOString(),
  payload: { followingId: createUserId() },
  ...overrides,
});

export const createKafkaUserDeletedEvent = (overrides: Record<string, unknown> = {}) => ({
  type: 'user_deleted',
  entityId: createUserId(),
  userId: createUserId(),
  timestamp: new Date().toISOString(),
  payload: { username: 'deleteduser' },
  ...overrides,
});

export const createJWT = (userId: string = createUserId()): string => {
  // Create a simple test JWT structure (signed with test secret)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      email: `${userId}@test.com`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url');
  // Signature will be invalid unless the test mocks jwt.verify
  return `${header}.${payload}.test-signature`;
};

/** A valid signed JWT for use in integration tests */
export const VALID_JWT_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
