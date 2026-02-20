/**
 * Integration Tests — Like Routes
 *
 * Richiede PostgreSQL + Redis raggiungibili su TEST_DATABASE_URL.
 * Eseguire con: npm run test:integration
 */

import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { getDatabase } from '../../src/config/database';
import { makeJWT, TEST_USER_ID, TEST_POST_ID, TEST_COMMENT_ID } from '../fixtures';

jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/metrics');

// Mock Kafka producer — non vogliamo un broker reale nei test integration
jest.mock('../../src/config/kafka', () => ({
  connectKafka: jest.fn().mockResolvedValue(undefined),
  disconnectKafka: jest.fn().mockResolvedValue(undefined),
  getKafkaProducer: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue(undefined),
  }),
  getKafkaConsumer: jest.fn(),
}));

// Mock Redis counter service
jest.mock('../../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(60),
    ping: jest.fn().mockResolvedValue('PONG'),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    sismember: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue(undefined),
  }),
}));

let app: Application;
let validToken: string;
let anotherToken: string;

beforeAll(async () => {
  app = await createApp();
  validToken = makeJWT(TEST_USER_ID);
  anotherToken = makeJWT('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
});

afterEach(async () => {
  // Clean up test data between tests
  const db = getDatabase();
  await db('likes').delete();
});

// ── POST /api/v1/posts/:postId/like ───────────────────────────────────────────

describe('POST /api/v1/posts/:postId/like', () => {
  it('should return 201 with like and like_count for authenticated user', async () => {
    const res = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/like`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('like');
    expect(res.body.data).toHaveProperty('like_count');
    expect(res.body.data.like.user_id).toBe(TEST_USER_ID);
    expect(res.body.data.like.target_type).toBe('POST');
  });

  it('should return 401 without Authorization header', async () => {
    const res = await request(app).post(`/api/v1/posts/${TEST_POST_ID}/like`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 with expired token', async () => {
    const expiredToken = makeJWT(TEST_USER_ID, {}, { expiresIn: '-1s' });

    const res = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/like`)
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it('should return 400 when postId is not a valid UUID', async () => {
    const res = await request(app)
      .post('/api/v1/posts/not-a-uuid/like')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 409 when user already liked the post', async () => {
    // First like
    await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/like`)
      .set('Authorization', `Bearer ${validToken}`);

    // Second like
    const res = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/like`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });
});

// ── DELETE /api/v1/posts/:postId/like ─────────────────────────────────────────

describe('DELETE /api/v1/posts/:postId/like', () => {
  it('should return 200 with decremented like_count after unlike', async () => {
    // Like first
    await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/like`)
      .set('Authorization', `Bearer ${validToken}`);

    // Unlike
    const res = await request(app)
      .delete(`/api/v1/posts/${TEST_POST_ID}/like`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('like_count');
  });

  it('should return 404 if like does not exist', async () => {
    const res = await request(app)
      .delete(`/api/v1/posts/${TEST_POST_ID}/like`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).delete(`/api/v1/posts/${TEST_POST_ID}/like`);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/posts/:postId/likes/count ────────────────────────────────────

describe('GET /api/v1/posts/:postId/likes/count', () => {
  it('should return 200 with like_count and is_liked=false for unauthenticated user', async () => {
    const res = await request(app).get(`/api/v1/posts/${TEST_POST_ID}/likes/count`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('like_count');
    expect(res.body.data.is_liked).toBe(false);
  });

  it('should return is_liked=true for authenticated user who liked the post', async () => {
    // Like the post first
    await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/like`)
      .set('Authorization', `Bearer ${validToken}`);

    const res = await request(app)
      .get(`/api/v1/posts/${TEST_POST_ID}/likes/count`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_liked).toBe(true);
  });

  it('should return is_liked=false for user who has NOT liked the post', async () => {
    // User A likes
    await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/like`)
      .set('Authorization', `Bearer ${validToken}`);

    // User B checks
    const res = await request(app)
      .get(`/api/v1/posts/${TEST_POST_ID}/likes/count`)
      .set('Authorization', `Bearer ${anotherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.is_liked).toBe(false);
  });
});

// ── Comment like routes ───────────────────────────────────────────────────────

describe('POST /api/v1/comments/:commentId/like', () => {
  it('should return 401 without auth', async () => {
    const res = await request(app).post(`/api/v1/comments/${TEST_COMMENT_ID}/like`);
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid commentId UUID', async () => {
    const res = await request(app)
      .post('/api/v1/comments/invalid-id/like')
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(400);
  });
});
