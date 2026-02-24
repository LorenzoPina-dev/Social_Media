/**
 * Unit Tests — TrendingService
 * Mock: ioredis (getRedisClient), logger, metrics
 */

import { TrendingService } from '../../../src/services/trending.service';

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

// Mock pipeline
const mockPipelineExec  = jest.fn().mockResolvedValue([]);
const mockPipelineZincrby = jest.fn().mockReturnThis();
const mockPipelineExpire  = jest.fn().mockReturnThis();
const mockPipeline = {
  zincrby: mockPipelineZincrby,
  expire:  mockPipelineExpire,
  exec:    mockPipelineExec,
};

const mockRedis = {
  pipeline:          jest.fn().mockReturnValue(mockPipeline),
  zrevrangebyscore:  jest.fn(),
  del:               jest.fn().mockResolvedValue(2),
  zscore:            jest.fn(),
};

jest.mock('../../../src/config/redis', () => ({
  getRedisClient: jest.fn(() => mockRedis),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TrendingService', () => {
  let service: TrendingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrendingService();
  });

  // ── incrementHashtags ─────────────────────────────────────────────────────

  describe('incrementHashtags', () => {
    it('should call zincrby for each tag via pipeline', async () => {
      await service.incrementHashtags(['typescript', 'javascript', 'nodejs']);

      expect(mockPipelineZincrby).toHaveBeenCalledTimes(3);
      expect(mockPipelineZincrby).toHaveBeenCalledWith('trending:hashtags', 1, 'typescript');
      expect(mockPipelineZincrby).toHaveBeenCalledWith('trending:hashtags', 1, 'javascript');
      expect(mockPipelineZincrby).toHaveBeenCalledWith('trending:hashtags', 1, 'nodejs');
    });

    it('should call expire to refresh TTL', async () => {
      await service.incrementHashtags(['test']);

      expect(mockPipelineExpire).toHaveBeenCalledWith('trending:hashtags', expect.any(Number));
    });

    it('should call pipeline.exec()', async () => {
      await service.incrementHashtags(['test']);

      expect(mockPipelineExec).toHaveBeenCalledTimes(1);
    });

    it('should handle empty array without error', async () => {
      await expect(service.incrementHashtags([])).resolves.not.toThrow();
      expect(mockPipelineExec).toHaveBeenCalledTimes(1);
    });

    it('should NOT throw when Redis fails (non-critical)', async () => {
      mockPipelineExec.mockRejectedValueOnce(new Error('Redis down'));

      await expect(service.incrementHashtags(['test'])).resolves.not.toThrow();
    });
  });

  // ── getTopHashtags ────────────────────────────────────────────────────────

  describe('getTopHashtags', () => {
    it('should return parsed trending hashtags from Redis ZSET', async () => {
      mockRedis.zrevrangebyscore.mockResolvedValueOnce([
        'javascript', '300',
        'typescript', '150',
        'nodejs',     '80',
      ]);

      const result = await service.getTopHashtags(3);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ tag: 'javascript', score: 300 });
      expect(result[1]).toEqual({ tag: 'typescript', score: 150 });
      expect(result[2]).toEqual({ tag: 'nodejs',     score: 80 });
    });

    it('should call zrevrangebyscore with correct key and ordering', async () => {
      mockRedis.zrevrangebyscore.mockResolvedValueOnce([]);

      await service.getTopHashtags(10);

      expect(mockRedis.zrevrangebyscore).toHaveBeenCalledWith(
        'trending:hashtags',
        '+inf',
        '-inf',
        'WITHSCORES',
        'LIMIT',
        0,
        10,
      );
    });

    it('should use default N when not provided', async () => {
      mockRedis.zrevrangebyscore.mockResolvedValueOnce([]);

      await service.getTopHashtags();

      const callArgs = (mockRedis.zrevrangebyscore as jest.Mock).mock.calls[0];
      expect(callArgs[6]).toBeGreaterThan(0); // n param
    });

    it('should return empty array when Redis is empty', async () => {
      mockRedis.zrevrangebyscore.mockResolvedValueOnce([]);

      const result = await service.getTopHashtags();

      expect(result).toHaveLength(0);
    });

    it('should return empty array when Redis fails', async () => {
      mockRedis.zrevrangebyscore.mockRejectedValueOnce(new Error('Connection reset'));

      const result = await service.getTopHashtags();

      expect(result).toHaveLength(0);
    });

    it('should parse float scores correctly', async () => {
      mockRedis.zrevrangebyscore.mockResolvedValueOnce(['tag', '42.5']);

      const result = await service.getTopHashtags();

      expect(result[0].score).toBe(42.5);
    });
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('should delete trending keys', async () => {
      await service.reset();

      expect(mockRedis.del).toHaveBeenCalledWith('trending:hashtags', 'trending:hashtags:window');
    });

    it('should NOT throw when del fails', async () => {
      mockRedis.del.mockRejectedValueOnce(new Error('Del error'));

      await expect(service.reset()).resolves.not.toThrow();
    });
  });

  // ── getScore ─────────────────────────────────────────────────────────────

  describe('getScore', () => {
    it('should return score for an existing tag', async () => {
      mockRedis.zscore.mockResolvedValueOnce('125');

      const score = await service.getScore('typescript');

      expect(score).toBe(125);
    });

    it('should return 0 when tag does not exist', async () => {
      mockRedis.zscore.mockResolvedValueOnce(null);

      const score = await service.getScore('nonexistent');

      expect(score).toBe(0);
    });

    it('should return 0 when Redis fails', async () => {
      mockRedis.zscore.mockRejectedValueOnce(new Error('Timeout'));

      const score = await service.getScore('error');

      expect(score).toBe(0);
    });
  });
});
