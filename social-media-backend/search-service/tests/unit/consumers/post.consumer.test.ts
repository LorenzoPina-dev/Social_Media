/**
 * Unit Tests — PostEventHandler (Kafka Consumer)
 * Mock: IndexerService, logger
 */

import { PostEventHandler } from '../../../src/kafka/consumers/post.consumer';
import {
  createPostCreatedEvent,
  createPostUpdatedEvent,
  createPostDeletedEvent,
} from '../../fixtures';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/utils/metrics', () => ({
  metrics: { recordIndexingOperation: jest.fn() },
}));

jest.mock('../../../src/services/elasticsearch.service');
jest.mock('../../../src/services/trending.service');

const mockIndexPost  = jest.fn().mockResolvedValue(undefined);
const mockUpdatePost = jest.fn().mockResolvedValue(undefined);
const mockDeletePost = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../src/services/indexer.service', () => ({
  IndexerService: jest.fn().mockImplementation(() => ({
    indexPost:  mockIndexPost,
    updatePost: mockUpdatePost,
    deletePost: mockDeletePost,
  })),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PostEventHandler', () => {
  let handler: PostEventHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new PostEventHandler();
  });

  describe('handle — post_created', () => {
    it('should call indexPost when post_created event received', async () => {
      const event = createPostCreatedEvent({ entityId: 'post-001' });

      await handler.handle(event);

      expect(mockIndexPost).toHaveBeenCalledTimes(1);
      expect(mockIndexPost).toHaveBeenCalledWith(event);
    });

    it('should NOT throw when indexPost fails (fault-tolerant)', async () => {
      mockIndexPost.mockRejectedValueOnce(new Error('ES error'));
      const event = createPostCreatedEvent();

      await expect(handler.handle(event)).resolves.not.toThrow();
    });
  });

  describe('handle — post_updated', () => {
    it('should call updatePost when post_updated event received', async () => {
      const event = createPostUpdatedEvent('post-002', {
        payload: { content: 'Updated content' },
      });

      await handler.handle(event);

      expect(mockUpdatePost).toHaveBeenCalledTimes(1);
      expect(mockUpdatePost).toHaveBeenCalledWith(event);
    });

    it('should NOT throw when updatePost fails', async () => {
      mockUpdatePost.mockRejectedValueOnce(new Error('ES timeout'));
      const event = createPostUpdatedEvent('post-003', { payload: {} });

      await expect(handler.handle(event)).resolves.not.toThrow();
    });
  });

  describe('handle — post_deleted', () => {
    it('should call deletePost when post_deleted event received', async () => {
      const event = createPostDeletedEvent('post-999');

      await handler.handle(event);

      expect(mockDeletePost).toHaveBeenCalledTimes(1);
      expect(mockDeletePost).toHaveBeenCalledWith('post-999');
    });

    it('should NOT throw when deletePost fails', async () => {
      mockDeletePost.mockRejectedValueOnce(new Error('Not found'));
      const event = createPostDeletedEvent('post-000');

      await expect(handler.handle(event)).resolves.not.toThrow();
    });
  });

  describe('handle — unknown event type', () => {
    it('should NOT throw for unknown event types', async () => {
      const unknownEvent = {
        type:      'post_archived' as any,
        entityId:  'post-xxx',
        userId:    'user-xxx',
        timestamp: new Date().toISOString(),
      };

      await expect(handler.handle(unknownEvent)).resolves.not.toThrow();
      expect(mockIndexPost).not.toHaveBeenCalled();
      expect(mockUpdatePost).not.toHaveBeenCalled();
      expect(mockDeletePost).not.toHaveBeenCalled();
    });
  });
});
