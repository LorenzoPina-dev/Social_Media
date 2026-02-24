/**
 * E2E Tests — Search Service Complete Flows
 * Simula scenari completi: indexing via Kafka events → ricerca via API.
 * Tutta l'infrastruttura è mockata.
 */

import request from 'supertest';
import express, { Application } from 'express';
import { setupRoutes } from '../../src/routes';
import { errorHandler } from '../../src/middleware/errorHandler';
import { UserEventHandler } from '../../src/kafka/consumers/user.consumer';
import { PostEventHandler } from '../../src/kafka/consumers/post.consumer';
import {
  createUserRegisteredEvent,
  createUserUpdatedEvent,
  createUserDeletedEvent,
  createPostCreatedEvent,
  createPostUpdatedEvent,
  createPostDeletedEvent,
  createSearchUserResult,
  createSearchPostResult,
  makeJWT,
} from '../fixtures';
import { v4 as uuidv4 } from 'uuid';

// ── Infrastructure Mocks ──────────────────────────────────────────────────────

// In-memory "database" simulante ES
const esStore: Map<string, Map<string, Record<string, unknown>>> = new Map([
  ['test_users',    new Map()],
  ['test_posts',    new Map()],
  ['test_hashtags', new Map()],
]);

const mockRedisClient = {
  get:    jest.fn().mockResolvedValue(null),
  setex:  jest.fn().mockResolvedValue('OK'),
  keys:   jest.fn().mockResolvedValue([]),
  del:    jest.fn().mockResolvedValue(0),
  incr:   jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl:    jest.fn().mockResolvedValue(60),
  ping:   jest.fn().mockResolvedValue('PONG'),
  zrevrangebyscore: jest.fn().mockResolvedValue([]),
  zscore:           jest.fn().mockResolvedValue(null),
  pipeline:         jest.fn().mockReturnValue({
    zincrby: jest.fn().mockReturnThis(),
    expire:  jest.fn().mockReturnThis(),
    exec:    jest.fn().mockResolvedValue([]),
  }),
};

jest.mock('../../src/config/redis', () => ({
  connectRedis:    jest.fn().mockResolvedValue(mockRedisClient),
  getRedisClient:  jest.fn().mockReturnValue(mockRedisClient),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
}));

const mockEsClientInstance = {
  cluster: { health: jest.fn().mockResolvedValue({ status: 'green' }) },
};
jest.mock('../../src/config/elasticsearch', () => ({
  connectElasticsearch:    jest.fn().mockResolvedValue(mockEsClientInstance),
  getElasticsearchClient:  jest.fn().mockReturnValue(mockEsClientInstance),
  disconnectElasticsearch: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/setupElasticsearch', () => ({
  setupElasticsearchIndices: jest.fn().mockResolvedValue(undefined),
  INDEX: { USERS: 'test_users', POSTS: 'test_posts', HASHTAGS: 'test_hashtags' },
}));

jest.mock('../../src/config/kafka', () => ({
  connectKafka:    jest.fn().mockResolvedValue(undefined),
  disconnectKafka: jest.fn().mockResolvedValue(undefined),
}));

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

// Mock ElasticsearchService with in-memory store
const mockEsSearch  = jest.fn();
const mockEsSuggest = jest.fn().mockResolvedValue([]);
const mockEsIndex   = jest.fn();
const mockEsUpdate  = jest.fn();
const mockEsDelete  = jest.fn();

jest.mock('../../src/services/elasticsearch.service', () => ({
  ElasticsearchService: jest.fn().mockImplementation(() => ({
    search:        mockEsSearch,
    suggest:       mockEsSuggest,
    indexDocument: mockEsIndex,
    updateDocument:mockEsUpdate,
    deleteDocument:mockEsDelete,
    isHealthy:     jest.fn().mockResolvedValue(true),
  })),
}));

// ── Test Helpers ──────────────────────────────────────────────────────────────

async function buildApp(): Promise<Application> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  setupRoutes(app);
  app.use(errorHandler);
  return app;
}

// ── E2E Tests ─────────────────────────────────────────────────────────────────

describe('E2E — Search Service Flows', () => {
  let app: Application;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.incr.mockResolvedValue(1); // rate limit ok
    mockRedisClient.get.mockResolvedValue(null); // no cache
  });

  // ────────────────────────────────────────────────────────────────────────────
  // FLOW 1: User lifecycle — Register → Search → Update → Search → Delete → Search
  // ────────────────────────────────────────────────────────────────────────────

  describe('Flow 1: User Lifecycle', () => {
    const userId = uuidv4();

    it('Step 1: user_registered event → user should be indexable', async () => {
      mockEsIndex.mockResolvedValue(undefined);

      const event = createUserRegisteredEvent({
        entityId: userId,
        payload:  { username: 'alice_wonder', email: 'alice@example.com' },
      });

      const handler = new UserEventHandler();
      await handler.handle(event);

      expect(mockEsIndex).toHaveBeenCalledTimes(1);
      const [index, id, doc] = (mockEsIndex as jest.Mock).mock.calls[0];
      expect(index).toContain('users');
      expect(id).toBe(userId);
      expect(doc.username).toBe('alice_wonder');
    });

    it('Step 2: search for alice → returns results', async () => {
      const user = createSearchUserResult({ id: userId, username: 'alice_wonder' });
      mockEsSearch.mockResolvedValueOnce({ hits: [user], total: 1, took: 3 });

      const res = await request(app).get('/api/v1/search/users?q=alice');

      expect(res.status).toBe(200);
      expect(res.body.data[0].username).toBe('alice_wonder');
    });

    it('Step 3: user_updated event → updates Elasticsearch', async () => {
      mockEsUpdate.mockResolvedValue(undefined);

      const event = createUserUpdatedEvent({
        entityId: userId,
        payload:  { display_name: 'Alice Wonderland', verified: true, changedFields: ['display_name', 'verified'] },
      });

      const handler = new UserEventHandler();
      await handler.handle(event);

      expect(mockEsUpdate).toHaveBeenCalledTimes(1);
      const [, id, fields] = (mockEsUpdate as jest.Mock).mock.calls[0];
      expect(id).toBe(userId);
      expect(fields.display_name).toBe('Alice Wonderland');
      expect(fields.verified).toBe(true);
    });

    it('Step 4: user_deleted event → removes from index', async () => {
      mockEsDelete.mockResolvedValue(undefined);

      const event = createUserDeletedEvent(userId);
      const handler = new UserEventHandler();
      await handler.handle(event);

      expect(mockEsDelete).toHaveBeenCalledTimes(1);
      const [index, id] = (mockEsDelete as jest.Mock).mock.calls[0];
      expect(index).toContain('users');
      expect(id).toBe(userId);
    });

    it('Step 5: search after delete → no results', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });

      const res = await request(app).get('/api/v1/search/users?q=alice');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // FLOW 2: Post lifecycle — Create PUBLIC → Search → Moderate (REJECT) → Verify gone
  // ────────────────────────────────────────────────────────────────────────────

  describe('Flow 2: Post Lifecycle with Moderation', () => {
    const postId  = uuidv4();
    const authorId = uuidv4();

    it('Step 1: post_created (PUBLIC, PENDING) → indexed', async () => {
      mockEsIndex.mockResolvedValue(undefined);

      const event = createPostCreatedEvent({
        entityId: postId,
        payload: {
          user_id:           authorId,
          content:           'Hello #typescript world!',
          hashtags:          ['typescript'],
          visibility:        'PUBLIC',
          like_count:        0,
          comment_count:     0,
          moderation_status: 'PENDING',
        },
      });

      const handler = new PostEventHandler();
      await handler.handle(event);

      expect(mockEsIndex).toHaveBeenCalledTimes(1);
      const [index, id] = (mockEsIndex as jest.Mock).mock.calls[0];
      expect(index).toContain('posts');
      expect(id).toBe(postId);
    });

    it('Step 2: search "typescript" → post is found', async () => {
      const post = createSearchPostResult({ id: postId, hashtags: ['typescript'] });
      mockEsSearch.mockResolvedValueOnce({ hits: [post], total: 1, took: 4 });

      const res = await request(app).get('/api/v1/search/posts?q=typescript');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('Step 3: post_updated with moderation_status=REJECTED → deleted from index', async () => {
      mockEsDelete.mockResolvedValue(undefined);
      mockEsUpdate.mockResolvedValue(undefined);

      const event = createPostUpdatedEvent(postId, {
        payload: { moderation_status: 'REJECTED' },
      });

      const handler = new PostEventHandler();
      await handler.handle(event);

      // Should delete, NOT update
      expect(mockEsDelete).toHaveBeenCalledTimes(1);
      expect(mockEsUpdate).not.toHaveBeenCalled();
    });

    it('Step 4: search after rejection → no results', async () => {
      mockEsSearch.mockResolvedValueOnce({ hits: [], total: 0, took: 1 });

      const res = await request(app).get('/api/v1/search/posts?q=typescript');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('Step 5: post_deleted event → removes from index', async () => {
      mockEsDelete.mockResolvedValue(undefined);

      const event = createPostDeletedEvent(postId);
      const handler = new PostEventHandler();
      await handler.handle(event);

      expect(mockEsDelete).toHaveBeenCalledWith(expect.stringContaining('posts'), postId);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // FLOW 3: Hashtag search and trending
  // ────────────────────────────────────────────────────────────────────────────

  describe('Flow 3: Hashtag Trending Flow', () => {
    it('Step 1: creating posts with hashtags increments trending', async () => {
      mockEsIndex.mockResolvedValue(undefined);
      const pipelineMock = {
        zincrby: jest.fn().mockReturnThis(),
        expire:  jest.fn().mockReturnThis(),
        exec:    jest.fn().mockResolvedValue([]),
      };
      mockRedisClient.pipeline.mockReturnValue(pipelineMock);

      const event = createPostCreatedEvent({
        payload: {
          user_id:           uuidv4(),
          content:           '#javascript is awesome',
          hashtags:          ['javascript'],
          visibility:        'PUBLIC',
          like_count:        0,
          comment_count:     0,
          moderation_status: 'APPROVED',
        },
      });

      const handler = new PostEventHandler();
      await handler.handle(event);

      // trending should be incremented
      expect(pipelineMock.zincrby).toHaveBeenCalledWith('trending:hashtags', 1, 'javascript');
    });

    it('Step 2: GET /trending/hashtags returns top hashtags from Redis', async () => {
      mockRedisClient.zrevrangebyscore.mockResolvedValueOnce([
        'javascript', '50',
        'typescript', '30',
      ]);

      const res = await request(app).get('/api/v1/search/trending/hashtags');

      expect(res.status).toBe(200);
      expect(res.body.data[0]).toMatchObject({ tag: 'javascript', score: 50 });
      expect(res.body.data[1]).toMatchObject({ tag: 'typescript', score: 30 });
    });

    it('Step 3: GET /hashtag/:tag returns posts for that hashtag', async () => {
      const post = createSearchPostResult({ hashtags: ['javascript'] });
      mockEsSearch.mockResolvedValueOnce({ hits: [post], total: 1, took: 2 });

      const res = await request(app).get('/api/v1/search/hashtag/javascript');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // FLOW 4: Autocomplete with cache
  // ────────────────────────────────────────────────────────────────────────────

  describe('Flow 4: Autocomplete Cache Flow', () => {
    it('Step 1: first suggest call hits Elasticsearch and populates cache', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null); // cache miss
      mockEsSuggest.mockResolvedValue(['alice', 'alexis']);

      const res = await request(app).get('/api/v1/search/suggest?q=al&type=user');

      expect(res.status).toBe(200);
      expect(mockEsSuggest).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalled(); // cache populated
    });

    it('Step 2: second suggest call uses Redis cache (ES not called)', async () => {
      const cached = JSON.stringify([{ type: 'user', text: 'alice' }]);
      mockRedisClient.get.mockResolvedValueOnce(cached);

      const res = await request(app).get('/api/v1/search/suggest?q=al&type=user');

      expect(res.status).toBe(200);
      expect(mockEsSuggest).not.toHaveBeenCalled(); // served from cache
      expect(res.body.data[0].text).toBe('alice');
    });

    it('Step 3: user_updated with username change invalidates cache', async () => {
      mockEsUpdate.mockResolvedValue(undefined);
      mockRedisClient.keys.mockResolvedValueOnce(['suggest:user:alice', 'suggest:all:alice']);
      mockRedisClient.del.mockResolvedValueOnce(2);

      const event = createUserUpdatedEvent({
        payload: { username: 'alice_new', changedFields: ['username'] },
      });

      const handler = new UserEventHandler();
      await handler.handle(event);

      expect(mockRedisClient.del).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // FLOW 5: PRIVATE/FOLLOWERS post — must NOT appear in search
  // ────────────────────────────────────────────────────────────────────────────

  describe('Flow 5: Private Content Isolation', () => {
    it('should NOT index PRIVATE posts', async () => {
      mockEsIndex.mockResolvedValue(undefined);

      const event = createPostCreatedEvent({
        payload: {
          user_id:           uuidv4(),
          content:           'private thoughts',
          hashtags:          [],
          visibility:        'PRIVATE',
          like_count:        0,
          comment_count:     0,
          moderation_status: 'APPROVED',
        },
      });

      const handler = new PostEventHandler();
      await handler.handle(event);

      expect(mockEsIndex).not.toHaveBeenCalled();
    });

    it('should NOT index FOLLOWERS-only posts', async () => {
      mockEsIndex.mockResolvedValue(undefined);

      const event = createPostCreatedEvent({
        payload: {
          user_id:           uuidv4(),
          content:           'followers only',
          hashtags:          [],
          visibility:        'FOLLOWERS',
          like_count:        0,
          comment_count:     0,
          moderation_status: 'APPROVED',
        },
      });

      const handler = new PostEventHandler();
      await handler.handle(event);

      expect(mockEsIndex).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // FLOW 6: Multi-user search results
  // ────────────────────────────────────────────────────────────────────────────

  describe('Flow 6: Multi-result search with pagination', () => {
    it('should return paginated results with correct meta', async () => {
      const users = Array.from({ length: 5 }, (_, i) =>
        createSearchUserResult({ username: `user_${i}`, score: 5 - i }),
      );
      mockEsSearch.mockResolvedValueOnce({ hits: users, total: 50, took: 8 });

      const res = await request(app).get('/api/v1/search/users?q=user&limit=5&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.meta.total).toBe(50);
      expect(res.body.meta.limit).toBe(5);
      expect(res.body.meta.offset).toBe(0);
    });

    it('should return next page', async () => {
      const users = Array.from({ length: 5 }, (_, i) =>
        createSearchUserResult({ username: `user_${5 + i}` }),
      );
      mockEsSearch.mockResolvedValueOnce({ hits: users, total: 50, took: 5 });

      const res = await request(app).get('/api/v1/search/users?q=user&limit=5&offset=5');

      expect(res.status).toBe(200);
      expect(res.body.meta.offset).toBe(5);
    });
  });
});
