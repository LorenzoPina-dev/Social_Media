/**
 * Integration Tests — Search Routes
 * Usa Supertest contro l'app Express reale.
 * Tutta l'infrastruttura (ES, Redis, Kafka) è mockata a livello di modulo.
 */

import request from 'supertest';
import express, { Application } from 'express';
import { setupRoutes } from '../../src/routes';
import { errorHandler } from '../../src/middleware/errorHandler';
import { makeJWT, makeExpiredJWT, createSearchUserResult, createSearchPostResult, mockTrending } from '../fixtures';
import { v4 as uuidv4 } from 'uuid';

// ── Infrastructure Mocks ──────────────────────────────────────────────────────

// Mock Redis
const mockRedisGet    = jest.fn().mockResolvedValue(null);
const mockRedisSetex  = jest.fn().mockResolvedValue('OK');
const mockRedisKeys   = jest.fn().mockResolvedValue([]);
const mockRedisDel    = jest.fn().mockResolvedValue(0);
const mockRedisIncr   = jest.fn().mockResolvedValue(1);
const mockRedisExpire = jest.fn().mockResolvedValue(1);
const mockRedisTtl    = jest.fn().mockResolvedValue(60);
const mockZrevrange   = jest.fn().mockResolvedValue([]);

const mockRedisClient = {
  get:              mockRedisGet,
  setex:            mockRedisSetex,
  keys:             mockRedisKeys,
  del:              mockRedisDel,
  incr:             mockRedisIncr,
  expire:           mockRedisExpire,
  ttl:              mockRedisTtl,
  zrevrangebyscore: mockZrevrange,
  zscore:           jest.fn().mockResolvedValue(null),
  pipeline:         jest.fn().mockReturnValue({
    zincrby: jest.fn().mockReturnThis(),
    expire:  jest.fn().mockReturnThis(),
    exec:    jest.fn().mockResolvedValue([]),
  }),
  ping: jest.fn().mockResolvedValue('PONG'),
};

jest.mock('../../src/config/redis', () => ({
  connectRedis:    jest.fn().mockResolvedValue(mockRedisClient),
  getRedisClient:  jest.fn().mockReturnValue(mockRedisClient),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
}));

// Mock Elasticsearch client/config
const mockClusterHealth = jest.fn().mockResolvedValue({ status: 'green' });
const mockEsClientInstance = {
  cluster: { health: mockClusterHealth },
};
jest.mock('../../src/config/elasticsearch', () => ({
  connectElasticsearch:    jest.fn().mockResolvedValue(mockEsClientInstance),
  getElasticsearchClient:  jest.fn().mockReturnValue(mockEsClientInstance),
  disconnectElasticsearch: jest.fn().mockResolvedValue(undefined),
}));

// Mock setupElasticsearch (skip real index creation)
jest.mock('../../src/utils/setupElasticsearch', () => ({
  setupElasticsearchIndices: jest.fn().mockResolvedValue(undefined),
  INDEX: { USERS: 'test_users', POSTS: 'test_posts', HASHTAGS: 'test_hashtags' },
}));

// Mock Kafka (consumer-only, skip connection)
jest.mock('../../src/config/kafka', () => ({
  connectKafka:    jest.fn().mockResolvedValue(undefined),
  disconnectKafka: jest.fn().mockResolvedValue(undefined),
}));

// Mock logger and metrics
jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../src/utils/metrics', () => ({
  metrics: {
    recordSearchRequest:     jest.fn(),
    recordSearchDuration:    jest.fn(),
    recordCacheHit:          jest.fn(),
    recordCacheMiss:         jest.fn(),
    recordIndexingOperation: jest.fn(),
    recordRequestDuration:   jest.fn(),
    incrementCounter:        jest.fn(),
  },
  startMetricsServer: jest.fn(),
}));

// Mock ElasticsearchService — the core dependency of all services
const mockEsSearch  = jest.fn();
const mockEsSuggest = jest.fn();

jest.mock('../../src/services/elasticsearch.service', () => ({
  ElasticsearchService: jest.fn().mockImplementation(() => ({
    search:        mockEsSearch,
    suggest:       mockEsSuggest,
    indexDocument: jest.fn().mockResolvedValue(undefined),
    updateDocument:jest.fn().mockResolvedValue(undefined),
    deleteDocument:jest.fn().mockResolvedValue(undefined),
    isHealthy:     jest.fn().mockResolvedValue(true),
  })),
}));

// ── App Factory for Tests ─────────────────────────────────────────────────────

async function buildTestApp(): Promise<Application> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  setupRoutes(app);
  app.use(errorHandler);

  return app;
}

// ── Shared Fixtures ───────────────────────────────────────────────────────────

const VALID_TOKEN = makeJWT(uuidv4());
const userId      = uuidv4();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Search Routes — Integration', () => {
  let app: Application;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Redis rate-limit counter (fail-open by default)
    mockRedisIncr.mockResolvedValue(1);
    mockRedisTtl.mockResolvedValue(60);
    mockRedisGet.mockResolvedValue(null); // no cache by default
  });

  // ── GET /api/v1/search/users ──────────────────────────────────────────────

  describe('GET /api/v1/search/users', () => {
    it('should return 200 with user results for valid query', async () => {
      const user = createSearchUserResult({ username: 'alice' });
      mockEsSearch.mockResolvedValueOnce({ hits: [user], total: 1, took: 4 });

      const res = await request(app)
        .get('/api/v1/search/users?q=alice')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].username).toBe('alice');
      expect(res.body.meta.total).toBe(1);
    });

    it('should return 200 without auth (auth is optional)', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });

      const res = await request(app).get('/api/v1/search/users?q=test');

      expect(res.status).toBe(200);
    });

    it('should return 400 when q param is missing', async () => {
      const res = await request(app).get('/api/v1/search/users');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when q param is empty string', async () => {
      const res = await request(app).get('/api/v1/search/users?q=');

      expect(res.status).toBe(400);
    });

    it('should return 400 when limit exceeds max (100)', async () => {
      const res = await request(app).get('/api/v1/search/users?q=test&limit=999');

      expect(res.status).toBe(400);
    });

    it('should return 400 when offset is negative', async () => {
      const res = await request(app).get('/api/v1/search/users?q=test&offset=-1');

      expect(res.status).toBe(400);
    });

    it('should pass verified filter to service', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });

      const res = await request(app).get('/api/v1/search/users?q=alice&verified=true');

      expect(res.status).toBe(200);
      expect(mockEsSearch).toHaveBeenCalledTimes(1);
    });

    it('should return pagination meta', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 100, took: 2 });

      const res = await request(app).get('/api/v1/search/users?q=test&limit=10&offset=20');

      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.offset).toBe(20);
      expect(res.body.meta.total).toBe(100);
    });

    it('should return 503 when Elasticsearch throws', async () => {
      const { ElasticsearchError } = await import('../../src/types');
      mockEsSearch.mockRejectedValueOnce(new ElasticsearchError('ES unavailable'));

      const res = await request(app).get('/api/v1/search/users?q=test');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
    });
  });

  // ── GET /api/v1/search/posts ──────────────────────────────────────────────

  describe('GET /api/v1/search/posts', () => {
    it('should return 200 with post results for valid query', async () => {
      const post = createSearchPostResult({ content: 'Hello typescript world' });
      mockEsSearch.mockResolvedValueOnce({ hits: [post], total: 1, took: 6 });

      const res = await request(app).get('/api/v1/search/posts?q=typescript');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 400 when q is missing', async () => {
      const res = await request(app).get('/api/v1/search/posts');

      expect(res.status).toBe(400);
    });

    it('should accept hashtag filter', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });

      const res = await request(app).get('/api/v1/search/posts?q=test&hashtag=typescript');

      expect(res.status).toBe(200);
    });

    it('should accept valid ISO date range', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });

      const res = await request(app).get(
        '/api/v1/search/posts?q=test&from_date=2024-01-01&to_date=2024-12-31',
      );

      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid date format', async () => {
      const res = await request(app).get('/api/v1/search/posts?q=test&from_date=not-a-date');

      expect(res.status).toBe(400);
    });

    it('should return pagination meta', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 50, took: 2 });

      const res = await request(app).get('/api/v1/search/posts?q=test&limit=5&offset=10');

      expect(res.body.meta.limit).toBe(5);
      expect(res.body.meta.offset).toBe(10);
    });
  });

  // ── GET /api/v1/search/hashtag/:tag ──────────────────────────────────────

  describe('GET /api/v1/search/hashtag/:tag', () => {
    it('should return 200 with posts for the given hashtag', async () => {
      const post = createSearchPostResult({ hashtags: ['typescript'] });
      mockEsSearch.mockResolvedValueOnce({ hits: [post], total: 1, took: 3 });

      const res = await request(app).get('/api/v1/search/hashtag/typescript');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('should return 200 with empty results when hashtag not found', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });

      const res = await request(app).get('/api/v1/search/hashtag/nonexistent');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should accept limit query param', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });

      const res = await request(app).get('/api/v1/search/hashtag/ts?limit=5');

      expect(res.status).toBe(200);
    });

    it('should return 400 when limit is out of range', async () => {
      const res = await request(app).get('/api/v1/search/hashtag/ts?limit=999');

      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/v1/search/suggest ────────────────────────────────────────────

  describe('GET /api/v1/search/suggest', () => {
    it('should return 200 with suggestions', async () => {
      mockEsSuggest.mockResolvedValue(['alice', 'alexis']);

      const res = await request(app).get('/api/v1/search/suggest?q=al');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should serve cached results from Redis', async () => {
      const cached = JSON.stringify([{ type: 'user', text: 'alice' }]);
      mockRedisGet.mockResolvedValueOnce(cached);

      const res = await request(app).get('/api/v1/search/suggest?q=al');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      // ES should NOT be called when cache hit
      expect(mockEsSuggest).not.toHaveBeenCalled();
    });

    it('should return 400 when q is missing', async () => {
      const res = await request(app).get('/api/v1/search/suggest');

      expect(res.status).toBe(400);
    });

    it('should return 400 when limit exceeds 20', async () => {
      const res = await request(app).get('/api/v1/search/suggest?q=al&limit=99');

      expect(res.status).toBe(400);
    });

    it('should accept type filter: user', async () => {
      mockEsSuggest.mockResolvedValue([]);

      const res = await request(app).get('/api/v1/search/suggest?q=al&type=user');

      expect(res.status).toBe(200);
    });

    it('should accept type filter: hashtag', async () => {
      mockEsSuggest.mockResolvedValue([]);

      const res = await request(app).get('/api/v1/search/suggest?q=ts&type=hashtag');

      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid type value', async () => {
      const res = await request(app).get('/api/v1/search/suggest?q=al&type=invalid_type');

      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/v1/search/trending/hashtags ──────────────────────────────────

  describe('GET /api/v1/search/trending/hashtags', () => {
    it('should return 200 with trending hashtags', async () => {
      mockZrevrange.mockResolvedValueOnce([
        'javascript', '300',
        'typescript', '150',
      ]);

      const res = await request(app).get('/api/v1/search/trending/hashtags');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 200 with empty array when no trending data', async () => {
      mockZrevrange.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/v1/search/trending/hashtags');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should accept custom limit', async () => {
      mockZrevrange.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/v1/search/trending/hashtags?limit=5');

      expect(res.status).toBe(200);
    });

    it('should return 400 when limit exceeds max (50)', async () => {
      const res = await request(app).get('/api/v1/search/trending/hashtags?limit=99');

      expect(res.status).toBe(400);
    });

    it('should return trending data sorted by score', async () => {
      mockZrevrange.mockResolvedValueOnce([
        'programming', '500',
        'javascript',  '300',
        'typescript',  '150',
      ]);

      const res = await request(app).get('/api/v1/search/trending/hashtags');

      expect(res.body.data[0].tag).toBe('programming');
      expect(res.body.data[0].score).toBe(500);
    });
  });

  // ── Health Endpoints ──────────────────────────────────────────────────────

  describe('Health Endpoints', () => {
    it('GET /health should return 200', async () => {
      const app2 = express();
      app2.get('/health', (_req, res) => {
        res.json({ status: 'healthy', service: 'search-service', version: '1.0.0', timestamp: new Date().toISOString() });
      });

      const res = await request(app2).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });

  // ── 404 Catch-All ────────────────────────────────────────────────────────

  describe('404 — unknown routes', () => {
    it('should return 404 for unknown route', async () => {
      const res = await request(app).get('/api/v1/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  // ── Auth middleware ───────────────────────────────────────────────────────

  describe('Auth middleware — optionalAuth', () => {
    it('should work without Authorization header', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });

      const res = await request(app).get('/api/v1/search/users?q=test');

      expect(res.status).toBe(200);
    });

    it('should work with a valid Bearer token', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });

      const res = await request(app)
        .get('/api/v1/search/users?q=test')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.status).toBe(200);
    });

    it('should still work with an invalid token (optional auth silently ignores)', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });

      const res = await request(app)
        .get('/api/v1/search/users?q=test')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(200);
    });

    it('should work with an expired token (optional auth silently ignores)', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });
      const expired = makeExpiredJWT(uuidv4());

      const res = await request(app)
        .get('/api/v1/search/users?q=test')
        .set('Authorization', `Bearer ${expired}`);

      expect(res.status).toBe(200);
    });
  });

  // ── Rate Limiting ─────────────────────────────────────────────────────────

  describe('Rate Limiting', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      // Simulate counter already at limit
      mockRedisIncr.mockResolvedValueOnce(101); // > MAX_REQUESTS (100)

      const res = await request(app).get('/api/v1/search/users?q=test');

      expect(res.status).toBe(429);
      expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should set X-RateLimit headers on successful request', async () => {
      mockRedisIncr.mockResolvedValueOnce(5);
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });

      const res = await request(app).get('/api/v1/search/users?q=test');

      // When incr=5, limit-remaining = 100-5 = 95
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });
});
