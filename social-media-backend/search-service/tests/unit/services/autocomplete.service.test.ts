/**
 * Unit Tests — AutocompleteService
 * Mock: ElasticsearchService, Redis, logger, metrics
 */

import { AutocompleteService } from '../../../src/services/autocomplete.service';
import { ElasticsearchService } from '../../../src/services/elasticsearch.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/utils/metrics', () => ({
  metrics: {
    recordCacheHit:  jest.fn(),
    recordCacheMiss: jest.fn(),
  },
}));

jest.mock('../../../src/services/elasticsearch.service');

const mockRedis = {
  get:    jest.fn(),
  setex:  jest.fn().mockResolvedValue('OK'),
  keys:   jest.fn().mockResolvedValue([]),
  del:    jest.fn().mockResolvedValue(1),
};

jest.mock('../../../src/config/redis', () => ({
  getRedisClient: jest.fn(() => mockRedis),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const MockEs = ElasticsearchService as jest.MockedClass<typeof ElasticsearchService>;

function buildService(): { service: AutocompleteService; mockEs: jest.Mocked<ElasticsearchService> } {
  const mockEs = new MockEs() as jest.Mocked<ElasticsearchService>;
  const service = new AutocompleteService(mockEs);
  return { service, mockEs };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AutocompleteService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── suggest ───────────────────────────────────────────────────────────────

  describe('suggest', () => {
    it('should return empty array for empty prefix', async () => {
      const { service } = buildService();

      const result = await service.suggest('', 'all', 10);

      expect(result).toHaveLength(0);
    });

    it('should return cached results from Redis when cache hit', async () => {
      const { service } = buildService();
      const cached = [{ type: 'user', text: 'alice' }];
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(cached));

      const result = await service.suggest('al', 'user', 10);

      expect(result).toEqual(cached);
    });

    it('should call ES suggest when Redis cache misses', async () => {
      const { service, mockEs } = buildService();
      mockRedis.get.mockResolvedValueOnce(null);
      mockEs.suggest = jest.fn().mockResolvedValue(['alice', 'alexis']);

      const result = await service.suggest('al', 'user', 10);

      expect(mockEs.suggest).toHaveBeenCalledTimes(1);
      expect(result.some((r) => r.text === 'alice')).toBe(true);
    });

    it('should populate Redis cache after ES query', async () => {
      const { service, mockEs } = buildService();
      mockRedis.get.mockResolvedValueOnce(null);
      mockEs.suggest = jest.fn().mockResolvedValue(['alice']);

      await service.suggest('al', 'user', 10);

      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
    });

    it('should query ES for both users and hashtags when type=all', async () => {
      const { service, mockEs } = buildService();
      mockRedis.get.mockResolvedValueOnce(null);
      mockEs.suggest = jest.fn().mockResolvedValue([]);

      await service.suggest('te', 'all', 10);

      // called once for users, once for hashtags
      expect(mockEs.suggest).toHaveBeenCalledTimes(2);
    });

    it('should query only user index when type=user', async () => {
      const { service, mockEs } = buildService();
      mockRedis.get.mockResolvedValueOnce(null);
      mockEs.suggest = jest.fn().mockResolvedValue([]);

      await service.suggest('al', 'user', 10);

      expect(mockEs.suggest).toHaveBeenCalledTimes(1);
      expect((mockEs.suggest as jest.Mock).mock.calls[0][2]).toBe('al');
    });

    it('should query only hashtag index when type=hashtag', async () => {
      const { service, mockEs } = buildService();
      mockRedis.get.mockResolvedValueOnce(null);
      mockEs.suggest = jest.fn().mockResolvedValue([]);

      await service.suggest('ty', 'hashtag', 10);

      expect(mockEs.suggest).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate results', async () => {
      const { service, mockEs } = buildService();
      mockRedis.get.mockResolvedValueOnce(null);
      // Return same text from both user and hashtag
      mockEs.suggest = jest.fn().mockResolvedValue(['typescript']);

      const result = await service.suggest('type', 'all', 10);

      const texts = result.map((r) => r.text);
      // Can have both 'user:typescript' and 'hashtag:typescript' as distinct types
      const uniqueKeys = new Set(result.map((r) => `${r.type}:${r.text}`));
      expect(uniqueKeys.size).toBe(result.length);
    });

    it('should limit results to the requested limit', async () => {
      const { service, mockEs } = buildService();
      mockRedis.get.mockResolvedValueOnce(null);
      // Return many results
      mockEs.suggest = jest.fn().mockResolvedValue(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);

      const result = await service.suggest('x', 'user', 3);

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should normalize prefix to lowercase', async () => {
      const { service, mockEs } = buildService();
      mockRedis.get.mockResolvedValueOnce(null);
      mockEs.suggest = jest.fn().mockResolvedValue([]);

      await service.suggest('ALICE', 'user', 10);

      // Redis key should be lowercase
      const cacheKey = (mockRedis.get as jest.Mock).mock.calls[0][0] as string;
      expect(cacheKey).toContain('alice');
    });

    it('should return empty array when ES suggest throws', async () => {
      const { service, mockEs } = buildService();
      mockRedis.get.mockResolvedValueOnce(null);
      mockEs.suggest = jest.fn().mockRejectedValue(new Error('ES error'));

      const result = await service.suggest('fail', 'user', 10);

      expect(result).toHaveLength(0);
    });

    it('should proceed even if Redis read fails (fail-open)', async () => {
      const { service, mockEs } = buildService();
      mockRedis.get.mockRejectedValueOnce(new Error('Redis timeout'));
      mockEs.suggest = jest.fn().mockResolvedValue(['alice']);

      const result = await service.suggest('al', 'user', 10);

      expect(result.some((r) => r.text === 'alice')).toBe(true);
    });

    it('should proceed even if Redis write fails', async () => {
      const { service, mockEs } = buildService();
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.setex.mockRejectedValueOnce(new Error('Redis write fail'));
      mockEs.suggest = jest.fn().mockResolvedValue(['alice']);

      await expect(service.suggest('al', 'user', 10)).resolves.toBeDefined();
    });
  });

  // ── invalidateCache ───────────────────────────────────────────────────────

  describe('invalidateCache', () => {
    it('should delete matching cache keys', async () => {
      const { service } = buildService();
      mockRedis.keys.mockResolvedValueOnce(['suggest:user:alice', 'suggest:all:alice']);

      await service.invalidateCache('alice');

      expect(mockRedis.del).toHaveBeenCalledWith('suggest:user:alice', 'suggest:all:alice');
    });

    it('should NOT call del when no keys match', async () => {
      const { service } = buildService();
      mockRedis.keys.mockResolvedValueOnce([]);

      await service.invalidateCache('nobody');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should NOT throw when Redis fails during invalidation', async () => {
      const { service } = buildService();
      mockRedis.keys.mockRejectedValueOnce(new Error('Redis down'));

      await expect(service.invalidateCache('test')).resolves.not.toThrow();
    });
  });
});
