/**
 * Unit tests for the user Kafka consumer
 */

import { redisMock } from '../../__mocks__/redis.mock';

jest.mock('../../../src/config/redis', () => ({
  getRedisClient: jest.fn(() => redisMock),
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/utils/metrics', () => ({
  metrics: { incrementCounter: jest.fn() },
}));

const mockFetchFollowerIds = jest.fn();
const mockFetchUserRecentPostIds = jest.fn();

jest.mock('../../../src/services/http.service', () => ({
  fetchFollowerIds: mockFetchFollowerIds,
  fetchUserRecentPostIds: mockFetchUserRecentPostIds,
}));

import { handleUserEvent } from '../../../src/kafka/consumers/user.consumer';
import { createKafkaUserDeletedEvent, createKafkaFollowCreatedEvent, createUserId, createPostId } from '../../fixtures';

describe('user.consumer — handleUserEvent', () => {
  beforeEach(() => {
    redisMock.flushAll();
    jest.clearAllMocks();
    mockFetchFollowerIds.mockResolvedValue({ followerIds: ['f1', 'f2'], followerCount: 2 });
    mockFetchUserRecentPostIds.mockResolvedValue([]);
  });

  // ── user_deleted ────────────────────────────────────────────────────────────

  describe('user_deleted', () => {
    it('should clear the deleted user\'s own feed', async () => {
      const userId = createUserId();
      await redisMock.zadd(`feed:${userId}`, 100, 'post1');

      const event = createKafkaUserDeletedEvent({ entityId: userId, userId });
      await handleUserEvent(event as any);

      expect(await redisMock.zcard(`feed:${userId}`)).toBe(0);
    });

    it('should remove the deleted user\'s posts from all follower feeds', async () => {
      const userId = createUserId();
      const postId = createPostId();

      // Set up follower feeds with one of the author's posts
      await redisMock.zadd('feed:f1', 100, postId);
      await redisMock.zadd('feed:f2', 100, postId);

      mockFetchUserRecentPostIds.mockResolvedValue([postId]);
      mockFetchFollowerIds.mockResolvedValue({ followerIds: ['f1', 'f2'], followerCount: 2 });

      const event = createKafkaUserDeletedEvent({ entityId: userId, userId });
      await handleUserEvent(event as any);

      expect(await redisMock.zscore('feed:f1', postId)).toBeNull();
      expect(await redisMock.zscore('feed:f2', postId)).toBeNull();
    });
  });

  // ── follow_created ──────────────────────────────────────────────────────────

  describe('follow_created', () => {
    it('should add recent posts of the followed user to the follower\'s feed', async () => {
      const followerId = createUserId();
      const followingId = createUserId();
      const recentPostId = createPostId();

      mockFetchUserRecentPostIds.mockResolvedValue([recentPostId]);

      const event = createKafkaFollowCreatedEvent({
        userId: followerId,
        payload: { followingId },
      });

      await handleUserEvent(event as any);

      const entries = redisMock.getZSetEntries(`feed:${followerId}`);
      expect(entries.some((e) => e.member === recentPostId)).toBe(true);
    });

    it('should handle follow_created when followed user has no posts', async () => {
      mockFetchUserRecentPostIds.mockResolvedValue([]);

      const event = createKafkaFollowCreatedEvent();
      await expect(handleUserEvent(event as any)).resolves.toBeUndefined();
    });
  });

  // ── follow_deleted ──────────────────────────────────────────────────────────

  describe('follow_deleted', () => {
    it('should remove posts authored by the unfollowed user from the follower\'s feed', async () => {
      const followerId = createUserId();
      const unfollowedId = createUserId();
      const postId = createPostId();

      await redisMock.zadd(`feed:${followerId}`, 100, postId);

      mockFetchUserRecentPostIds.mockResolvedValue([postId]);

      const event = {
        type: 'follow_deleted',
        entityId: followerId,
        userId: followerId,
        timestamp: new Date().toISOString(),
        payload: { followingId: unfollowedId },
      };

      await handleUserEvent(event as any);

      expect(await redisMock.zscore(`feed:${followerId}`, postId)).toBeNull();
    });

    it('should not throw if unfollowed user has no posts', async () => {
      mockFetchUserRecentPostIds.mockResolvedValue([]);

      const event = {
        type: 'follow_deleted',
        entityId: createUserId(),
        userId: createUserId(),
        timestamp: new Date().toISOString(),
        payload: { followingId: createUserId() },
      };

      await expect(handleUserEvent(event as any)).resolves.toBeUndefined();
    });
  });

  // ── user_updated ────────────────────────────────────────────────────────────

  describe('user_updated', () => {
    it('should take no action and not throw', async () => {
      const event = { type: 'user_updated', entityId: createUserId(), userId: createUserId(), timestamp: new Date().toISOString(), payload: {} };
      await expect(handleUserEvent(event as any)).resolves.toBeUndefined();
    });
  });

  // ── unknown event ───────────────────────────────────────────────────────────

  describe('unknown event', () => {
    it('should handle unknown user event without throwing', async () => {
      const event = { type: 'user_suspended', entityId: createUserId(), userId: createUserId(), timestamp: new Date().toISOString(), payload: {} };
      await expect(handleUserEvent(event as any)).resolves.toBeUndefined();
    });
  });
});
