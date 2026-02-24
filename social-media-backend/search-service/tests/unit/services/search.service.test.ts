/**
 * Unit Tests — SearchService
 * Mock: ElasticsearchService, logger, metrics
 */

import { SearchService } from '../../../src/services/search.service';
import { ElasticsearchService } from '../../../src/services/elasticsearch.service';
import {
  createSearchUserResult,
  createSearchPostResult,
} from '../../fixtures';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/utils/metrics', () => ({
  metrics: {
    recordSearchRequest:  jest.fn(),
    recordSearchDuration: jest.fn(),
    recordCacheHit:       jest.fn(),
    recordCacheMiss:      jest.fn(),
  },
}));

jest.mock('../../../src/services/elasticsearch.service');

// ── Helpers ───────────────────────────────────────────────────────────────────

const MockEs = ElasticsearchService as jest.MockedClass<typeof ElasticsearchService>;

function buildService(): { service: SearchService; mockEs: jest.Mocked<ElasticsearchService> } {
  const mockEs = new MockEs() as jest.Mocked<ElasticsearchService>;
  const service = new SearchService(mockEs);
  return { service, mockEs };
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('SearchService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── searchUsers ───────────────────────────────────────────────────────────

  describe('searchUsers', () => {
    it('should return hits from Elasticsearch', async () => {
      const { service, mockEs } = buildService();
      const user = createSearchUserResult({ username: 'alice', verified: true });

      mockEs.search = jest.fn().mockResolvedValue({ hits: [user], total: 1, took: 3 });

      const result = await service.searchUsers({ q: 'alice' });

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].username).toBe('alice');
      expect(result.total).toBe(1);
      expect(mockEs.search).toHaveBeenCalledTimes(1);
    });

    it('should pass verified filter when provided', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchUsers({ q: 'alice', verified: true });

      const callArgs = (mockEs.search as jest.Mock).mock.calls[0];
      const query = callArgs[1] as any;
      const must = query.bool.must as unknown[];
      expect(must.some((clause: any) => clause?.term?.verified === true)).toBe(true);
    });

    it('should NOT add verified filter when not provided', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchUsers({ q: 'alice' });

      const callArgs = (mockEs.search as jest.Mock).mock.calls[0];
      const query = callArgs[1] as any;
      const must = query.bool.must as unknown[];
      expect(must.some((clause: any) => clause?.term?.verified === true)).toBe(false);
    });

    it('should always filter for ACTIVE users only', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchUsers({ q: 'test' });

      const callArgs = (mockEs.search as jest.Mock).mock.calls[0];
      const query = callArgs[1] as any;
      const must = query.bool.must as unknown[];
      expect(must.some((clause: any) => clause?.term?.status === 'ACTIVE')).toBe(true);
    });

    it('should cap limit at MAX_LIMIT (100)', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchUsers({ q: 'x', limit: 9999 });

      const options = (mockEs.search as jest.Mock).mock.calls[0][2] as any;
      expect(options.size).toBeLessThanOrEqual(100);
    });

    it('should use default limit (20) when none provided', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchUsers({ q: 'x' });

      const options = (mockEs.search as jest.Mock).mock.calls[0][2] as any;
      expect(options.size).toBe(20);
    });

    it('should use offset for pagination', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchUsers({ q: 'x', offset: 40 });

      const options = (mockEs.search as jest.Mock).mock.calls[0][2] as any;
      expect(options.from).toBe(40);
    });

    it('should propagate Elasticsearch errors', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockRejectedValue(new Error('ES down'));

      await expect(service.searchUsers({ q: 'fail' })).rejects.toThrow('ES down');
    });

    it('should return empty result when no matches', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 2 });

      const result = await service.searchUsers({ q: 'nobody' });

      expect(result.hits).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ── searchPosts ───────────────────────────────────────────────────────────

  describe('searchPosts', () => {
    it('should return post hits from Elasticsearch', async () => {
      const { service, mockEs } = buildService();
      const post = createSearchPostResult({ content: 'typescript is great' });

      mockEs.search = jest.fn().mockResolvedValue({ hits: [post], total: 1, took: 5 });

      const result = await service.searchPosts({ q: 'typescript' });

      expect(result.hits).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter only PUBLIC posts', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchPosts({ q: 'test' });

      const query = (mockEs.search as jest.Mock).mock.calls[0][1] as any;
      const must = query.bool.must as unknown[];
      expect(must.some((c: any) => c?.term?.visibility === 'PUBLIC')).toBe(true);
    });

    it('should exclude REJECTED posts via must_not', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchPosts({ q: 'test' });

      const query = (mockEs.search as jest.Mock).mock.calls[0][1] as any;
      const mustNot = query.bool.must_not as unknown[];
      expect(mustNot.some((c: any) => c?.term?.moderation_status === 'REJECTED')).toBe(true);
    });

    it('should add hashtag filter when hashtag is provided', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchPosts({ q: 'test', hashtag: '#typescript' });

      const query = (mockEs.search as jest.Mock).mock.calls[0][1] as any;
      const must = query.bool.must as unknown[];
      expect(must.some((c: any) => c?.term?.hashtags === 'typescript')).toBe(true);
    });

    it('should strip # from hashtag before filtering', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchPosts({ q: 'x', hashtag: '#nodejs' });

      const query = (mockEs.search as jest.Mock).mock.calls[0][1] as any;
      const must = query.bool.must as unknown[];
      const filter = must.find((c: any) => c?.term?.hashtags);
      expect((filter as any)?.term?.hashtags).toBe('nodejs');
    });

    it('should add date range filter when both dates are provided', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchPosts({ q: 'x', from_date: '2024-01-01', to_date: '2024-12-31' });

      const query = (mockEs.search as jest.Mock).mock.calls[0][1] as any;
      const must = query.bool.must as unknown[];
      const rangeFilter = must.find((c: any) => c?.range?.created_at);
      expect(rangeFilter).toBeDefined();
      expect((rangeFilter as any).range.created_at.gte).toBe('2024-01-01');
      expect((rangeFilter as any).range.created_at.lte).toBe('2024-12-31');
    });

    it('should add only from_date when to_date is absent', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchPosts({ q: 'x', from_date: '2024-06-01' });

      const query = (mockEs.search as jest.Mock).mock.calls[0][1] as any;
      const must = query.bool.must as unknown[];
      const rangeFilter = must.find((c: any) => c?.range?.created_at);
      expect((rangeFilter as any).range.created_at.gte).toBe('2024-06-01');
      expect((rangeFilter as any).range.created_at.lte).toBeUndefined();
    });

    it('should NOT add date range when no dates are provided', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchPosts({ q: 'x' });

      const query = (mockEs.search as jest.Mock).mock.calls[0][1] as any;
      const must = query.bool.must as unknown[];
      const rangeFilter = must.find((c: any) => c?.range?.created_at);
      expect(rangeFilter).toBeUndefined();
    });

    it('should propagate Elasticsearch errors', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockRejectedValue(new Error('Index error'));

      await expect(service.searchPosts({ q: 'fail' })).rejects.toThrow('Index error');
    });
  });

  // ── searchByHashtag ───────────────────────────────────────────────────────

  describe('searchByHashtag', () => {
    it('should return posts matching the hashtag', async () => {
      const { service, mockEs } = buildService();
      const post = createSearchPostResult({ hashtags: ['typescript'] });

      mockEs.search = jest.fn().mockResolvedValue({ hits: [post], total: 1, took: 2 });

      const result = await service.searchByHashtag('typescript');

      expect(result.hits).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should normalize hashtag by removing # prefix', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchByHashtag('#nodejs');

      const query = (mockEs.search as jest.Mock).mock.calls[0][1] as any;
      const must = query.bool.must as unknown[];
      const tagFilter = must.find((c: any) => c?.term?.hashtags);
      expect((tagFilter as any).term.hashtags).toBe('nodejs');
    });

    it('should lowercase hashtag', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchByHashtag('TypeScript');

      const query = (mockEs.search as jest.Mock).mock.calls[0][1] as any;
      const must = query.bool.must as unknown[];
      const tagFilter = must.find((c: any) => c?.term?.hashtags);
      expect((tagFilter as any).term.hashtags).toBe('typescript');
    });

    it('should use custom limit when provided', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchByHashtag('ts', 50);

      const options = (mockEs.search as jest.Mock).mock.calls[0][2] as any;
      expect(options.size).toBe(50);
    });

    it('should use custom offset for pagination', async () => {
      const { service, mockEs } = buildService();
      mockEs.search = jest.fn().mockResolvedValue({ hits: [], total: 0, took: 1 });

      await service.searchByHashtag('ts', 20, 60);

      const options = (mockEs.search as jest.Mock).mock.calls[0][2] as any;
      expect(options.from).toBe(60);
    });
  });
});
