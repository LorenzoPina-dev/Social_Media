/**
 * Unit tests for the interaction Kafka consumer
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
jest.mock('../../../src/services/http.service', () => ({
  fetchFollowerIds: mockFetchFollowerIds,
}));

import { handleInteractionEvent } from '../../../src/kafka/consumers/interaction.consumer';
import { createKafkaLikeCreatedEvent, createUserId, createPostId } from '../../fixtures';

describe('interaction.consumer — handleInteractionEvent', () => {
  const postId = createPostId();
  const userId = createUserId();

  beforeEach(() => {
    redisMock.flushAll();
    jest.clearAllMocks();
    mockFetchFollowerIds.mockResolvedValue({ followerIds: ['f1', 'f2'], followerCount: 2 });
  });

  describe('like_created', () => {
    it('should boost the post score by 10 in all follower feeds', async () => {
      await redisMock.zadd('feed:f1', 1000, postId);
      await redisMock.zadd('feed:f2', 1000, postId);

      const event = {
        ...createKafkaLikeCreatedEvent(),
        entityId: postId,
        userId,
        payload: { userId, targetType: 'POST' },
      };

      await handleInteractionEvent(event as any);

      expect(await redisMock.zscore('feed:f1', postId)).toBe('1010');
      expect(await redisMock.zscore('feed:f2', postId)).toBe('1010');
    });

    it('should NOT boost score for COMMENT likes', async () => {
      await redisMock.zadd('feed:f1', 1000, postId);

      const event = {
        ...createKafkaLikeCreatedEvent(),
        entityId: postId,
        userId,
        payload: { userId, targetType: 'COMMENT' },
      };

      await handleInteractionEvent(event as any);

      // Score unchanged
      expect(await redisMock.zscore('feed:f1', postId)).toBe('1000');
    });
  });

  describe('like_deleted', () => {
    it('should reduce the post score by 10 in follower feeds', async () => {
      await redisMock.zadd('feed:f1', 1010, postId);

      const event = { type: 'like_deleted', entityId: postId, userId, timestamp: new Date().toISOString(), payload: {} };

      await handleInteractionEvent(event as any);

      expect(await redisMock.zscore('feed:f1', postId)).toBe('1000');
    });
  });

  describe('share_created', () => {
    it('should boost the post score by 30 in follower feeds', async () => {
      await redisMock.zadd('feed:f1', 1000, postId);

      const event = { type: 'share_created', entityId: postId, userId, timestamp: new Date().toISOString(), payload: { userId } };

      await handleInteractionEvent(event as any);

      expect(await redisMock.zscore('feed:f1', postId)).toBe('1030');
    });
  });

  describe('comment_created', () => {
    it('should boost the post score by 20 in follower feeds', async () => {
      await redisMock.zadd('feed:f1', 1000, postId);

      const event = { type: 'comment_created', entityId: postId, userId, timestamp: new Date().toISOString(), payload: { postId, userId } };

      await handleInteractionEvent(event as any);

      expect(await redisMock.zscore('feed:f1', postId)).toBe('1020');
    });
  });

  describe('comment_deleted', () => {
    it('should skip without error', async () => {
      const event = { type: 'comment_deleted', entityId: postId, userId, timestamp: new Date().toISOString(), payload: {} };
      await expect(handleInteractionEvent(event as any)).resolves.toBeUndefined();
    });
  });

  describe('unknown event', () => {
    it('should handle unknown interaction event without throwing', async () => {
      const event = { type: 'reaction_created', entityId: postId, userId, timestamp: new Date().toISOString(), payload: {} };
      await expect(handleInteractionEvent(event as any)).resolves.toBeUndefined();
    });
  });
});
