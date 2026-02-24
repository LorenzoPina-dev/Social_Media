/**
 * Unit Tests — IndexerService
 * Mock: ElasticsearchService, TrendingService, logger, metrics
 */

import { IndexerService } from '../../../src/services/indexer.service';
import { ElasticsearchService } from '../../../src/services/elasticsearch.service';
import { TrendingService } from '../../../src/services/trending.service';
import {
  createUserRegisteredEvent,
  createUserUpdatedEvent,
  createUserDeletedEvent,
  createPostCreatedEvent,
  createPostUpdatedEvent,
  createPostDeletedEvent,
} from '../../fixtures';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/utils/metrics', () => ({
  metrics: {
    recordIndexingOperation: jest.fn(),
    recordSearchRequest:     jest.fn(),
    recordSearchDuration:    jest.fn(),
  },
}));

jest.mock('../../../src/services/elasticsearch.service');
jest.mock('../../../src/services/trending.service');

// ── Helpers ───────────────────────────────────────────────────────────────────

const MockEs       = ElasticsearchService as jest.MockedClass<typeof ElasticsearchService>;
const MockTrending = TrendingService      as jest.MockedClass<typeof TrendingService>;

function buildService(): {
  service:  IndexerService;
  mockEs:   jest.Mocked<ElasticsearchService>;
  mockTrend: jest.Mocked<TrendingService>;
} {
  const mockEs    = new MockEs()       as jest.Mocked<ElasticsearchService>;
  const mockTrend = new MockTrending() as jest.Mocked<TrendingService>;
  const service   = new IndexerService(mockEs, mockTrend);
  return { service, mockEs, mockTrend };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IndexerService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── indexUser ─────────────────────────────────────────────────────────────

  describe('indexUser', () => {
    it('should index user document in Elasticsearch', async () => {
      const { service, mockEs } = buildService();
      mockEs.indexDocument = jest.fn().mockResolvedValue(undefined);

      const event = createUserRegisteredEvent({ entityId: 'user-123' });
      await service.indexUser(event);

      expect(mockEs.indexDocument).toHaveBeenCalledTimes(1);
      const [index, id, doc] = (mockEs.indexDocument as jest.Mock).mock.calls[0];
      expect(index).toContain('users');
      expect(id).toBe('user-123');
      expect(doc.username).toBe(event.payload.username);
    });

    it('should set status to ACTIVE for new user', async () => {
      const { service, mockEs } = buildService();
      mockEs.indexDocument = jest.fn().mockResolvedValue(undefined);

      const event = createUserRegisteredEvent();
      await service.indexUser(event);

      const doc = (mockEs.indexDocument as jest.Mock).mock.calls[0][2];
      expect(doc.status).toBe('ACTIVE');
    });

    it('should set initial follower_count to 0', async () => {
      const { service, mockEs } = buildService();
      mockEs.indexDocument = jest.fn().mockResolvedValue(undefined);

      const event = createUserRegisteredEvent();
      await service.indexUser(event);

      const doc = (mockEs.indexDocument as jest.Mock).mock.calls[0][2];
      expect(doc.follower_count).toBe(0);
    });

    it('should set verified to false for new user', async () => {
      const { service, mockEs } = buildService();
      mockEs.indexDocument = jest.fn().mockResolvedValue(undefined);

      const event = createUserRegisteredEvent();
      await service.indexUser(event);

      const doc = (mockEs.indexDocument as jest.Mock).mock.calls[0][2];
      expect(doc.verified).toBe(false);
    });

    it('should propagate indexDocument errors', async () => {
      const { service, mockEs } = buildService();
      mockEs.indexDocument = jest.fn().mockRejectedValue(new Error('ES write failed'));

      const event = createUserRegisteredEvent();
      await expect(service.indexUser(event)).rejects.toThrow('ES write failed');
    });
  });

  // ── updateUser ────────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('should update changed fields in Elasticsearch', async () => {
      const { service, mockEs } = buildService();
      mockEs.updateDocument = jest.fn().mockResolvedValue(undefined);

      const event = createUserUpdatedEvent({
        entityId: 'user-456',
        payload:  { display_name: 'New Name', changedFields: ['display_name'] },
      });

      await service.updateUser(event);

      expect(mockEs.updateDocument).toHaveBeenCalledTimes(1);
      const [, id, fields] = (mockEs.updateDocument as jest.Mock).mock.calls[0];
      expect(id).toBe('user-456');
      expect(fields.display_name).toBe('New Name');
    });

    it('should NOT call updateDocument when changedFields is empty', async () => {
      const { service, mockEs } = buildService();
      mockEs.updateDocument = jest.fn().mockResolvedValue(undefined);

      const event = createUserUpdatedEvent({
        payload: { changedFields: [] },
      });

      await service.updateUser(event);

      expect(mockEs.updateDocument).not.toHaveBeenCalled();
    });

    it('should update multiple fields from changedFields', async () => {
      const { service, mockEs } = buildService();
      mockEs.updateDocument = jest.fn().mockResolvedValue(undefined);

      const event = createUserUpdatedEvent({
        payload: {
          username:      'new_username',
          display_name:  'New Display',
          changedFields: ['username', 'display_name'],
        },
      });

      await service.updateUser(event);

      const fields = (mockEs.updateDocument as jest.Mock).mock.calls[0][2];
      expect(fields.username).toBe('new_username');
      expect(fields.display_name).toBe('New Display');
    });

    it('should only update fields listed in changedFields', async () => {
      const { service, mockEs } = buildService();
      mockEs.updateDocument = jest.fn().mockResolvedValue(undefined);

      // bio present in payload but NOT in changedFields
      const event = createUserUpdatedEvent({
        payload: {
          display_name:  'Updated',
          bio:           'should not update',
          changedFields: ['display_name'],
        },
      });

      await service.updateUser(event);

      const fields = (mockEs.updateDocument as jest.Mock).mock.calls[0][2];
      expect(fields.display_name).toBe('Updated');
      expect(fields.bio).toBeUndefined();
    });
  });

  // ── deleteUser ────────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('should delete user from Elasticsearch', async () => {
      const { service, mockEs } = buildService();
      mockEs.deleteDocument = jest.fn().mockResolvedValue(undefined);

      await service.deleteUser('user-789');

      expect(mockEs.deleteDocument).toHaveBeenCalledTimes(1);
      const [index, id] = (mockEs.deleteDocument as jest.Mock).mock.calls[0];
      expect(index).toContain('users');
      expect(id).toBe('user-789');
    });
  });

  // ── indexPost ─────────────────────────────────────────────────────────────

  describe('indexPost', () => {
    it('should index a PUBLIC post', async () => {
      const { service, mockEs, mockTrend } = buildService();
      mockEs.indexDocument = jest.fn().mockResolvedValue(undefined);
      mockEs.deleteDocument = jest.fn().mockResolvedValue(undefined);
      mockTrend.incrementHashtags = jest.fn().mockResolvedValue(undefined);

      const event = createPostCreatedEvent({
        entityId: 'post-001',
        payload: {
          user_id:           'user-001',
          content:           'Hello world #typescript',
          hashtags:          ['typescript'],
          visibility:        'PUBLIC',
          like_count:        0,
          comment_count:     0,
          moderation_status: 'PENDING',
        },
      });

      await service.indexPost(event);

      expect(mockEs.indexDocument).toHaveBeenCalledTimes(1);
      const [index, id, doc] = (mockEs.indexDocument as jest.Mock).mock.calls[0];
      expect(index).toContain('posts');
      expect(id).toBe('post-001');
      expect(doc.content).toBe('Hello world #typescript');
    });

    it('should NOT index a non-PUBLIC post', async () => {
      const { service, mockEs } = buildService();
      mockEs.indexDocument = jest.fn().mockResolvedValue(undefined);

      const event = createPostCreatedEvent({
        payload: {
          user_id:           'user-001',
          content:           'private content',
          hashtags:          [],
          visibility:        'PRIVATE',
          like_count:        0,
          comment_count:     0,
          moderation_status: 'PENDING',
        },
      });

      await service.indexPost(event);

      expect(mockEs.indexDocument).not.toHaveBeenCalled();
    });

    it('should NOT index a REJECTED post', async () => {
      const { service, mockEs } = buildService();
      mockEs.indexDocument = jest.fn().mockResolvedValue(undefined);

      const event = createPostCreatedEvent({
        payload: {
          user_id:           'user-001',
          content:           'bad content',
          hashtags:          [],
          visibility:        'PUBLIC',
          like_count:        0,
          comment_count:     0,
          moderation_status: 'REJECTED',
        },
      });

      await service.indexPost(event);

      expect(mockEs.indexDocument).not.toHaveBeenCalled();
    });

    it('should increment trending hashtags after indexing', async () => {
      const { service, mockEs, mockTrend } = buildService();
      mockEs.indexDocument = jest.fn().mockResolvedValue(undefined);
      mockTrend.incrementHashtags = jest.fn().mockResolvedValue(undefined);

      const event = createPostCreatedEvent({
        payload: {
          user_id:           'user-001',
          content:           '#typescript post',
          hashtags:          ['typescript', 'nodejs'],
          visibility:        'PUBLIC',
          like_count:        0,
          comment_count:     0,
          moderation_status: 'APPROVED',
        },
      });

      await service.indexPost(event);

      expect(mockTrend.incrementHashtags).toHaveBeenCalledWith(['typescript', 'nodejs']);
    });

    it('should NOT call incrementHashtags when post has no hashtags', async () => {
      const { service, mockEs, mockTrend } = buildService();
      mockEs.indexDocument = jest.fn().mockResolvedValue(undefined);
      mockTrend.incrementHashtags = jest.fn().mockResolvedValue(undefined);

      const event = createPostCreatedEvent({
        payload: {
          user_id:           'user-001',
          content:           'No hashtags here',
          hashtags:          [],
          visibility:        'PUBLIC',
          like_count:        0,
          comment_count:     0,
          moderation_status: 'APPROVED',
        },
      });

      await service.indexPost(event);

      expect(mockTrend.incrementHashtags).not.toHaveBeenCalled();
    });
  });

  // ── updatePost ────────────────────────────────────────────────────────────

  describe('updatePost', () => {
    it('should update post content in Elasticsearch', async () => {
      const { service, mockEs } = buildService();
      mockEs.updateDocument = jest.fn().mockResolvedValue(undefined);
      mockEs.deleteDocument = jest.fn().mockResolvedValue(undefined);

      const event = createPostUpdatedEvent('post-002', {
        payload: { content: 'Updated content' },
      });

      await service.updatePost(event);

      expect(mockEs.updateDocument).toHaveBeenCalledTimes(1);
      const fields = (mockEs.updateDocument as jest.Mock).mock.calls[0][2];
      expect(fields.content).toBe('Updated content');
    });

    it('should DELETE post from index when moderation_status changes to REJECTED', async () => {
      const { service, mockEs } = buildService();
      mockEs.updateDocument = jest.fn().mockResolvedValue(undefined);
      mockEs.deleteDocument = jest.fn().mockResolvedValue(undefined);

      const event = createPostUpdatedEvent('post-003', {
        payload: { moderation_status: 'REJECTED' },
      });

      await service.updatePost(event);

      expect(mockEs.deleteDocument).toHaveBeenCalledTimes(1);
      expect(mockEs.updateDocument).not.toHaveBeenCalled();
    });

    it('should update hashtags when changed', async () => {
      const { service, mockEs } = buildService();
      mockEs.updateDocument = jest.fn().mockResolvedValue(undefined);
      mockEs.deleteDocument = jest.fn().mockResolvedValue(undefined);

      const event = createPostUpdatedEvent('post-004', {
        payload: { hashtags: ['newhashtag', 'another'] },
      });

      await service.updatePost(event);

      const fields = (mockEs.updateDocument as jest.Mock).mock.calls[0][2];
      expect(fields.hashtags).toEqual(['newhashtag', 'another']);
    });

    it('should NOT call updateDocument when payload has no fields to update', async () => {
      const { service, mockEs } = buildService();
      mockEs.updateDocument = jest.fn().mockResolvedValue(undefined);
      mockEs.deleteDocument = jest.fn().mockResolvedValue(undefined);

      const event = createPostUpdatedEvent('post-005', { payload: {} });

      await service.updatePost(event);

      expect(mockEs.updateDocument).not.toHaveBeenCalled();
    });
  });

  // ── deletePost ────────────────────────────────────────────────────────────

  describe('deletePost', () => {
    it('should delete post from Elasticsearch', async () => {
      const { service, mockEs } = buildService();
      mockEs.deleteDocument = jest.fn().mockResolvedValue(undefined);

      await service.deletePost('post-999');

      expect(mockEs.deleteDocument).toHaveBeenCalledTimes(1);
      const [index, id] = (mockEs.deleteDocument as jest.Mock).mock.calls[0];
      expect(index).toContain('posts');
      expect(id).toBe('post-999');
    });
  });
});
