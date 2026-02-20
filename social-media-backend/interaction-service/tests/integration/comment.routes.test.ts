/**
 * Integration Tests — Comment Routes
 */

import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { getDatabase } from '../../src/config/database';
import { makeJWT, TEST_USER_ID, TEST_POST_ID } from '../fixtures';
import { v4 as uuidv4 } from 'uuid';

jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/metrics');

jest.mock('../../src/config/kafka', () => ({
  connectKafka: jest.fn().mockResolvedValue(undefined),
  disconnectKafka: jest.fn().mockResolvedValue(undefined),
  getKafkaProducer: jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) }),
  getKafkaConsumer: jest.fn(),
}));

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
const OTHER_USER_ID = uuidv4();

beforeAll(async () => {
  app = await createApp();
  validToken  = makeJWT(TEST_USER_ID);
  anotherToken = makeJWT(OTHER_USER_ID);
});

afterEach(async () => {
  const db = getDatabase();
  await db('comment_closure').delete();
  await db('comments').delete();
});

// ── POST /api/v1/posts/:postId/comments ──────────────────────────────────────

describe('POST /api/v1/posts/:postId/comments', () => {
  it('should return 201 with created comment for authenticated user', async () => {
    const res = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ content: 'This is a great post!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      post_id: TEST_POST_ID,
      user_id: TEST_USER_ID,
      content: 'This is a great post!',
      depth: 0,
      parent_id: null,
    });
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .send({ content: 'Unauthorized comment' });

    expect(res.status).toBe(401);
  });

  it('should return 400 for empty content', async () => {
    const res = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for content exceeding 1000 characters', async () => {
    const res = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ content: 'a'.repeat(1001) });

    expect(res.status).toBe(400);
  });

  it('should create a nested reply with correct depth', async () => {
    // Create root comment
    const rootRes = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ content: 'Root comment' });

    const parentId = rootRes.body.data.id;

    // Create reply
    const replyRes = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .set('Authorization', `Bearer ${anotherToken}`)
      .send({ content: 'Reply to root', parent_id: parentId });

    expect(replyRes.status).toBe(201);
    expect(replyRes.body.data.depth).toBe(1);
    expect(replyRes.body.data.parent_id).toBe(parentId);
  });

  it('should return 400 for non-existent parent_id', async () => {
    const res = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ content: 'Reply to ghost', parent_id: uuidv4() });

    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid postId UUID', async () => {
    const res = await request(app)
      .post('/api/v1/posts/invalid-uuid/comments')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ content: 'Comment' });

    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/posts/:postId/comments ───────────────────────────────────────

describe('GET /api/v1/posts/:postId/comments', () => {
  it('should return empty list for post with no comments', async () => {
    const res = await request(app).get(`/api/v1/posts/${TEST_POST_ID}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.has_more).toBe(false);
  });

  it('should return paginated comments with has_more flag', async () => {
    // Create 3 comments
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: `Comment ${i + 1}` });
    }

    const res = await request(app)
      .get(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .query({ limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.has_more).toBe(true);
    expect(res.body.pagination.cursor).toBeDefined();
  });

  it('should include replies_count for each comment', async () => {
    // Create root comment
    const rootRes = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ content: 'Root with replies' });

    // Create 2 replies
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .send({ content: `Reply ${i + 1}`, parent_id: rootRes.body.data.id });
    }

    const res = await request(app).get(`/api/v1/posts/${TEST_POST_ID}/comments`);

    expect(res.status).toBe(200);
    const rootComment = res.body.data.find((c: any) => c.id === rootRes.body.data.id);
    expect(rootComment).toBeDefined();
    expect(rootComment.replies_count).toBe(2);
  });
});

// ── DELETE /api/v1/comments/:commentId ───────────────────────────────────────

describe('DELETE /api/v1/comments/:commentId', () => {
  it('should return 204 and soft-delete the comment', async () => {
    const createRes = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ content: 'To be deleted' });

    const commentId = createRes.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/comments/${commentId}`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(deleteRes.status).toBe(204);

    // Comment should now be inaccessible (soft deleted)
    const db = getDatabase();
    const comment = await db('comments').where({ id: commentId }).first();
    expect(comment.deleted_at).not.toBeNull();
  });

  it('should return 403 when non-owner tries to delete', async () => {
    const createRes = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ content: 'Owned by user A' });

    const commentId = createRes.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/comments/${commentId}`)
      .set('Authorization', `Bearer ${anotherToken}`);

    expect(deleteRes.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).delete(`/api/v1/comments/${uuidv4()}`);
    expect(res.status).toBe(401);
  });

  it('should return 404 for non-existent comment', async () => {
    const res = await request(app)
      .delete(`/api/v1/comments/${uuidv4()}`)
      .set('Authorization', `Bearer ${validToken}`);

    expect(res.status).toBe(404);
  });
});

// ── GET /api/v1/comments/:commentId/replies ──────────────────────────────────

describe('GET /api/v1/comments/:commentId/replies', () => {
  it('should return replies for a valid comment', async () => {
    // Create parent
    const parentRes = await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ content: 'Parent comment' });

    const parentId = parentRes.body.data.id;

    // Create reply
    await request(app)
      .post(`/api/v1/posts/${TEST_POST_ID}/comments`)
      .set('Authorization', `Bearer ${anotherToken}`)
      .send({ content: 'Reply', parent_id: parentId });

    const res = await request(app).get(`/api/v1/comments/${parentId}/replies`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].parent_id).toBe(parentId);
  });

  it('should return 404 for non-existent comment', async () => {
    const res = await request(app).get(`/api/v1/comments/${uuidv4()}/replies`);
    expect(res.status).toBe(404);
  });
});
