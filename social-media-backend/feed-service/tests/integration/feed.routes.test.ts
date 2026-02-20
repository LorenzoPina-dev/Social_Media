/**
 * Integration tests for feed HTTP routes
 *
 * Uses supertest against the real Express app.
 * Redis is mocked via the in-memory RedisMock.
 * JWT is mocked so auth passes with a known userId.
 */

import request from 'supertest';
import { Application } from 'express';
import { redisMock } from '../__mocks__/redis.mock';
import { VALID_JWT_USER_ID } from '../fixtures';

// ── Infrastructure mocks ─────────────────────────────────────────────────────

jest.mock('../../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  getRedisClient: jest.fn(() => redisMock),
  disconnectRedis: jest.fn(),
}));

jest.mock('../../src/config/kafka', () => ({
  connectKafka: jest.fn().mockResolvedValue(undefined),
  disconnectKafka: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../src/utils/metrics', () => ({
  metrics: { incrementCounter: jest.fn(), setFeedSize: jest.fn(), recordRequestDuration: jest.fn() },
  startMetricsServer: jest.fn(),
}));

// ── JWT mock — always decodes to VALID_JWT_USER_ID ──────────────────────────

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({
    userId: VALID_JWT_USER_ID,
    email: 'test@example.com',
    iat: 1000,
    exp: 9999999999,
  }),
}));

// ── App under test ───────────────────────────────────────────────────────────

let app: Application;

beforeAll(async () => {
  const { createApp } = await import('../../src/app');
  app = await createApp();
});

beforeEach(() => {
  redisMock.flushAll();
});

const AUTH_HEADER = { Authorization: 'Bearer valid.test.token' };

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/feed', () => {
  it('should return 200 with empty feed when no posts are present', async () => {
    const res = await request(app).get('/api/v1/feed').set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.hasMore).toBe(false);
    expect(res.body.data.nextCursor).toBeNull();
  });

  it('should return 401 without Authorization header', async () => {
    const res = await request(app).get('/api/v1/feed');
    expect(res.status).toBe(401);
  });

  it('should return 401 with expired token (jwt.verify throws)', async () => {
    const jwt = require('jsonwebtoken');
    jwt.verify.mockImplementationOnce(() => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      throw err;
    });

    const res = await request(app)
      .get('/api/v1/feed')
      .set({ Authorization: 'Bearer expired.token' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 with malformed token (jwt.verify throws JsonWebTokenError)', async () => {
    const jwt = require('jsonwebtoken');
    jwt.verify.mockImplementationOnce(() => {
      const err = new Error('invalid signature');
      err.name = 'JsonWebTokenError';
      throw err;
    });

    const res = await request(app)
      .get('/api/v1/feed')
      .set({ Authorization: 'Bearer bad.token' });

    expect(res.status).toBe(401);
  });

  it('should return paginated feed items in correct order (newest first)', async () => {
    // Seed feed for the test user
    const userId = VALID_JWT_USER_ID;
    await redisMock.zadd(`feed:${userId}`, 300, 'post-c');
    await redisMock.zadd(`feed:${userId}`, 100, 'post-a');
    await redisMock.zadd(`feed:${userId}`, 200, 'post-b');

    const res = await request(app).get('/api/v1/feed').set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.items[0].postId).toBe('post-c');
    expect(res.body.data.items[1].postId).toBe('post-b');
    expect(res.body.data.items[2].postId).toBe('post-a');
  });

  it('should respect the limit query parameter', async () => {
    const userId = VALID_JWT_USER_ID;
    for (let i = 0; i < 10; i++) {
      await redisMock.zadd(`feed:${userId}`, i * 100, `post${i}`);
    }

    const res = await request(app)
      .get('/api/v1/feed?limit=3')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(3);
  });

  it('should cap limit at 50', async () => {
    const userId = VALID_JWT_USER_ID;
    for (let i = 0; i < 60; i++) {
      await redisMock.zadd(`feed:${userId}`, i, `post${i}`);
    }

    const res = await request(app)
      .get('/api/v1/feed?limit=99')
      .set(AUTH_HEADER);

    expect(res.status).toBe(400);
  });

  it('should return hasMore:true and a nextCursor when more items exist', async () => {
    const userId = VALID_JWT_USER_ID;
    for (let i = 0; i < 25; i++) {
      await redisMock.zadd(`feed:${userId}`, i * 1000, `post${i}`);
    }

    const res = await request(app)
      .get('/api/v1/feed?limit=20')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.hasMore).toBe(true);
    expect(res.body.data.nextCursor).not.toBeNull();
  });

  it('should paginate correctly using the cursor from the first page', async () => {
    const userId = VALID_JWT_USER_ID;
    for (let i = 1; i <= 10; i++) {
      await redisMock.zadd(`feed:${userId}`, i * 10000, `post${i}`);
    }

    const page1 = await request(app)
      .get('/api/v1/feed?limit=5')
      .set(AUTH_HEADER);

    expect(page1.body.data.items).toHaveLength(5);
    const cursor = page1.body.data.nextCursor;
    expect(cursor).not.toBeNull();

    const page2 = await request(app)
      .get(`/api/v1/feed?limit=5&cursor=${encodeURIComponent(cursor)}`)
      .set(AUTH_HEADER);

    expect(page2.status).toBe(200);
    expect(page2.body.data.items.length).toBeGreaterThan(0);

    // No overlap between pages
    const p1Ids = page1.body.data.items.map((i: any) => i.postId);
    const p2Ids = page2.body.data.items.map((i: any) => i.postId);
    expect(p1Ids.filter((id: string) => p2Ids.includes(id))).toHaveLength(0);
  });

  it('should return 400 for an invalid limit parameter (non-numeric)', async () => {
    const res = await request(app)
      .get('/api/v1/feed?limit=abc')
      .set(AUTH_HEADER);

    // Joi rejects 'abc' as not a number
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/feed/size', () => {
  it('should return 200 with size 0 for empty feed', async () => {
    const res = await request(app).get('/api/v1/feed/size').set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.size).toBe(0);
  });

  it('should return correct size after posts are added to feed', async () => {
    const userId = VALID_JWT_USER_ID;
    await redisMock.zadd(`feed:${userId}`, 100, 'postA');
    await redisMock.zadd(`feed:${userId}`, 200, 'postB');

    const res = await request(app).get('/api/v1/feed/size').set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.size).toBe(2);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/v1/feed/size');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/v1/feed', () => {
  it('should return 200 and clear the user\'s feed', async () => {
    const userId = VALID_JWT_USER_ID;
    await redisMock.zadd(`feed:${userId}`, 100, 'post1');
    await redisMock.zadd(`feed:${userId}`, 200, 'post2');

    expect(await redisMock.zcard(`feed:${userId}`)).toBe(2);

    const res = await request(app)
      .delete('/api/v1/feed')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Feed should be empty now
    expect(await redisMock.zcard(`feed:${userId}`)).toBe(0);
  });

  it('should return 200 even if feed is already empty (idempotent)', async () => {
    const res = await request(app)
      .delete('/api/v1/feed')
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).delete('/api/v1/feed');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('should return 200 with healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('feed-service');
  });
});

describe('GET /health/ready', () => {
  it('should return 200 when Redis is available', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.redis).toBe('ok');
  });
});
