/**
 * Unit tests for the post Kafka consumer
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
  metrics: { incrementCounter: jest.fn(), setFeedSize: jest.fn() },
}));

// Mock HTTP service
const mockFetchFollowerIds = jest.fn();
jest.mock('../../../src/services/http.service', () => ({
  fetchFollowerIds: mockFetchFollowerIds,
  fetchUserRecentPostIds: jest.fn().mockResolvedValue([]),
}));

import { handlePostEvent } from '../../../src/kafka/consumers/post.consumer';
import { createKafkaPostCreatedEvent, createKafkaPostDeletedEvent } from '../../fixtures';

describe('post.consumer — handlePostEvent', () => {
  beforeEach(() => {
    redisMock.flushAll();
    mockFetchFollowerIds.mockResolvedValue({ followerIds: ['f1', 'f2'], followerCount: 2 });
    jest.clearAllMocks();
  });

  describe('post_created', () => {
    it('should fan-out a PUBLIC post to all followers and the author', async () => {
      const event = createKafkaPostCreatedEvent({
        payload: { userId: 'author1', content: 'hello', hashtags: [], visibility: 'PUBLIC' },
      });

      await handlePostEvent(event as any);

      // f1, f2 (followers) + author should all have the post
      const f1Entries = redisMock.getZSetEntries('feed:f1');
      expect(f1Entries.some((e) => e.member === event.entityId)).toBe(true);

      const authorEntries = redisMock.getZSetEntries(`feed:${event.userId}`);
      expect(authorEntries.some((e) => e.member === event.entityId)).toBe(true);
    });

    it('should fan-out a FOLLOWERS-only post', async () => {
      const event = createKafkaPostCreatedEvent({
        payload: { visibility: 'FOLLOWERS', content: 'followers only', hashtags: [] },
      });

      await handlePostEvent(event as any);

      const f1Entries = redisMock.getZSetEntries('feed:f1');
      expect(f1Entries.some((e) => e.member === event.entityId)).toBe(true);
    });

    it('should NOT fan-out a PRIVATE post', async () => {
      const event = createKafkaPostCreatedEvent({
        payload: { visibility: 'PRIVATE', content: 'private', hashtags: [] },
      });

      await handlePostEvent(event as any);

      const f1Entries = redisMock.getZSetEntries('feed:f1');
      expect(f1Entries.some((e) => e.member === event.entityId)).toBe(false);
    });

    it('should skip write fan-out for celebrity users (>100k followers)', async () => {
      mockFetchFollowerIds.mockResolvedValueOnce({
        followerIds: Array.from({ length: 100 }, (_, i) => `follower${i}`),
        followerCount: 150_000,
      });

      const event = createKafkaPostCreatedEvent();

      await handlePostEvent(event as any);

      // Followers should NOT have the post (no write fan-out)
      const follower0Entries = redisMock.getZSetEntries('feed:follower0');
      expect(follower0Entries.some((e) => e.member === event.entityId)).toBe(false);

      // But the author's own feed should have it
      const authorEntries = redisMock.getZSetEntries(`feed:${event.userId}`);
      expect(authorEntries.some((e) => e.member === event.entityId)).toBe(true);
    });

    it('should not throw even when fetchFollowerIds fails', async () => {
      mockFetchFollowerIds.mockRejectedValueOnce(new Error('HTTP timeout'));

      const event = createKafkaPostCreatedEvent();

      // Should not throw — errors are caught inside the consumer
      await expect(handlePostEvent(event as any)).resolves.toBeUndefined();
    });
  });

  describe('post_deleted', () => {
    it('should remove the post from all follower feeds', async () => {
      const postId = 'post-to-delete';
      await redisMock.zadd('feed:f1', 100, postId);
      await redisMock.zadd('feed:f2', 100, postId);

      const event = createKafkaPostDeletedEvent({ entityId: postId });

      await handlePostEvent(event as any);

      expect(await redisMock.zscore('feed:f1', postId)).toBeNull();
      expect(await redisMock.zscore('feed:f2', postId)).toBeNull();
    });
  });

  describe('post_updated', () => {
    it('should take no feed action for post_updated', async () => {
      await redisMock.zadd('feed:f1', 100, 'post1');

      const event = { ...createKafkaPostCreatedEvent(), type: 'post_updated' };

      await handlePostEvent(event as any);

      // Feed unchanged
      expect(await redisMock.zcard('feed:f1')).toBe(1);
    });
  });

  describe('unknown event type', () => {
    it('should handle unknown event type without throwing', async () => {
      const event = { ...createKafkaPostCreatedEvent(), type: 'post_archived' };
      await expect(handlePostEvent(event as any)).resolves.toBeUndefined();
    });
  });
});
