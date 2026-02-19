/**
 * Integration Tests — Post Routes
 *
 * Fix BUG 1: PRIVATE post senza auth ritorna 403 (non 401).
 *   checkVisibility() lancia PostForbiddenError (403) per tutti gli utenti
 *   non autorizzati, inclusi quelli non autenticati.
 *
 * Fix BUG 2: otherUserId era 'b1ffcd00-0d1c-5fg9-cc7e-7cc0ce491b22' con 'g'
 *   che non è hex valido → PostgreSQL avrebbe rifiutato l'INSERT.
 *
 * Fix BUG 7: scheduler.stop() chiamato in afterAll per evitare che il cron
 *   continui a girare durante i test.
 */

import request from 'supertest';
import { Application } from 'express';
import knex, { Knex } from 'knex';
import jwt from 'jsonwebtoken';

// ─── Mock Kafka prima di importare app ──────────────────────────────────────
jest.mock('../../src/config/kafka', () => ({
  connectKafka: jest.fn().mockResolvedValue(undefined),
  disconnectKafka: jest.fn().mockResolvedValue(undefined),
  getKafkaProducer: jest.fn(() => ({
    send: jest.fn().mockResolvedValue(undefined),
  })),
  getKafkaConsumer: jest.fn(() => ({})),
  registerKafkaHandler: jest.fn(),
}));

import { createApp } from '../../src/app';
import { SchedulerService } from '../../src/services/scheduler.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-min-32-chars-long!!';

function makeToken(userId: string, username = 'testuser'): string {
  return jwt.sign(
    { userId, username, email: `${username}@test.com`, verified: true, mfa_enabled: false, jti: `jti-${userId}` },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ─── Setup ───────────────────────────────────────────────────────────────────

let app: Application;
let db: Knex;
let scheduler: SchedulerService;

// BUG 2 FIX: UUID valido — tutti i caratteri devono essere 0-9 o a-f
const userId     = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const otherUserId = 'b1ffcd00-0d1c-4fa9-cc7e-7cc0ce491b22'; // corretto: 'g' → 'a', 'f' → 'f' ok

const authToken = makeToken(userId);

beforeAll(async () => {
  db = knex({
    client: 'postgresql',
    connection:
      process.env.TEST_DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/post_test_db',
    pool: { min: 1, max: 5 },
    migrations: { directory: './migrations', extension: 'ts' },
  });

  await db.migrate.latest();

  // BUG 7 FIX: salviamo lo scheduler per stopparlo in afterAll
  const result = await createApp();
  app = result.app;
  scheduler = result.scheduler;
}, 30000);

afterAll(async () => {
  // BUG 7 FIX: stoppa il cron job/interval del scheduler
  scheduler?.stop();
  await db.migrate.rollback(undefined, true);
  await db.destroy();
}, 30000);

beforeEach(async () => {
  await db.raw('TRUNCATE post_edit_history, post_hashtags, hashtags, posts CASCADE');
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/v1/posts', () => {
  it('should return 201 with post data for valid input', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Hello world #test', visibility: 'PUBLIC' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      content: 'Hello world #test',
      visibility: 'PUBLIC',
      moderation_status: 'PENDING',
    });
    expect(res.body.data.id).toBeDefined();
  });

  it('should return 201 and extract hashtags from content', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Post with #nodejs and #typescript' });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toContain('#nodejs');
  });

  it('should return 400 for empty content', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for content > 2000 chars', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'A'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 for missing content field', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ visibility: 'PUBLIC' });

    expect(res.status).toBe(400);
  });

  it('should return 401 without Authorization header', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .send({ content: 'No auth post' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should set moderation_status to PENDING on creation', async () => {
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'New post content' });

    expect(res.status).toBe(201);
    expect(res.body.data.moderation_status).toBe('PENDING');
  });

  it('should create a scheduled post when scheduled_at is in the future', async () => {
    const futureDate = new Date(Date.now() + 3600_000).toISOString();
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Scheduled post', scheduled_at: futureDate });

    expect(res.status).toBe(201);
    expect(res.body.data.is_scheduled).toBe(true);
  });

  it('should return 400 for scheduled_at in the past', async () => {
    const pastDate = new Date(Date.now() - 3600_000).toISOString();
    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Past scheduled', scheduled_at: pastDate });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/posts/:id', () => {
  let postId: string;

  beforeEach(async () => {
    const [post] = await db('posts')
      .insert({
        user_id: userId,
        content: 'Test post content',
        visibility: 'PUBLIC',
        moderation_status: 'APPROVED',
        is_scheduled: false,
        published_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id');
    postId = post.id ?? post;
  });

  it('should return 200 for PUBLIC post without auth', async () => {
    const res = await request(app).get(`/api/v1/posts/${postId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(postId);
  });

  it('should return 200 for PUBLIC post with auth', async () => {
    const res = await request(app)
      .get(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Test post content');
  });

  it('should return 404 for non-existent post', async () => {
    const res = await request(app).get(
      '/api/v1/posts/00000000-0000-0000-0000-000000000000',
    );
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('should return 400 for invalid UUID format', async () => {
    const res = await request(app).get('/api/v1/posts/not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('should return 404 for soft-deleted post', async () => {
    await db('posts').where({ id: postId }).update({ deleted_at: new Date() });
    const res = await request(app).get(`/api/v1/posts/${postId}`);
    expect(res.status).toBe(404);
  });

  // BUG 1 FIX: unauthenticated + PRIVATE → 403 (non 401)
  // Il route usa optionalAuth: la richiesta arriva al controller senza req.user.
  // checkVisibility() lancia PostForbiddenError (403) perché
  // post.user_id !== undefined (requesterId è undefined).
  it('should return 403 for PRIVATE post without auth', async () => {
    const [privatePost] = await db('posts')
      .insert({
        user_id: otherUserId,
        content: 'Private content',
        visibility: 'PRIVATE',
        moderation_status: 'APPROVED',
        is_scheduled: false,
        published_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id');
    const privateId = privatePost.id ?? privatePost;

    const res = await request(app).get(`/api/v1/posts/${privateId}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should return 403 for PRIVATE post of another authenticated user', async () => {
    const [privatePost] = await db('posts')
      .insert({
        user_id: otherUserId,
        content: 'Private content',
        visibility: 'PRIVATE',
        moderation_status: 'APPROVED',
        is_scheduled: false,
        published_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id');
    const privateId = privatePost.id ?? privatePost;

    const res = await request(app)
      .get(`/api/v1/posts/${privateId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should return PRIVATE post to its owner', async () => {
    const [ownPrivate] = await db('posts')
      .insert({
        user_id: userId,
        content: 'My private post',
        visibility: 'PRIVATE',
        moderation_status: 'APPROVED',
        is_scheduled: false,
        published_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id');
    const ownPrivateId = ownPrivate.id ?? ownPrivate;

    const res = await request(app)
      .get(`/api/v1/posts/${ownPrivateId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/users/:userId/posts', () => {
  beforeEach(async () => {
    await db('posts').insert([
      {
        user_id: userId,
        content: 'Post 1 #tag',
        visibility: 'PUBLIC',
        moderation_status: 'APPROVED',
        is_scheduled: false,
        published_at: new Date(),
        created_at: new Date(Date.now() - 3000),
        updated_at: new Date(),
      },
      {
        user_id: userId,
        content: 'Post 2',
        visibility: 'PUBLIC',
        moderation_status: 'APPROVED',
        is_scheduled: false,
        published_at: new Date(),
        created_at: new Date(Date.now() - 2000),
        updated_at: new Date(),
      },
      {
        user_id: userId,
        content: 'Post 3 private',
        visibility: 'PRIVATE',
        moderation_status: 'APPROVED',
        is_scheduled: false,
        published_at: new Date(),
        created_at: new Date(Date.now() - 1000),
        updated_at: new Date(),
      },
    ]);
  });

  it('should return paginated list excluding PRIVATE posts (no auth)', async () => {
    const res = await request(app).get(`/api/v1/users/${userId}/posts`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    res.body.data.forEach((p: { visibility: string }) => {
      expect(p.visibility).not.toBe('PRIVATE');
    });
  });

  it('should include PRIVATE posts when requester is the owner', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${userId}/posts`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const hasPrivate = res.body.data.some((p: { visibility: string }) => p.visibility === 'PRIVATE');
    expect(hasPrivate).toBe(true);
  });

  it('should advance cursor correctly on second page', async () => {
    const first = await request(app).get(`/api/v1/users/${userId}/posts?limit=2`);
    expect(first.status).toBe(200);

    if (first.body.hasMore) {
      const second = await request(app).get(
        `/api/v1/users/${userId}/posts?limit=2&cursor=${first.body.cursor}`,
      );
      expect(second.status).toBe(200);
      const firstIds = first.body.data.map((p: { id: string }) => p.id);
      second.body.data.forEach((p: { id: string }) => {
        expect(firstIds).not.toContain(p.id);
      });
    }
  });

  it('should return empty list for user with no posts', async () => {
    const newUserId = '11111111-1111-1111-1111-111111111111';
    const res = await request(app).get(`/api/v1/users/${newUserId}/posts`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.hasMore).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('PUT /api/v1/posts/:id', () => {
  let postId: string;

  beforeEach(async () => {
    const [post] = await db('posts')
      .insert({
        user_id: userId,
        content: 'Original content',
        visibility: 'PUBLIC',
        moderation_status: 'APPROVED',
        is_scheduled: false,
        published_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id');
    postId = post.id ?? post;
  });

  it('should return 200 with updated post', async () => {
    const res = await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Updated content' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('Updated content');
  });

  it('should create an edit_history entry when content changes', async () => {
    await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Changed content' });

    const history = await db('post_edit_history').where({ post_id: postId });
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].previous_content).toBe('Original content');
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .put(`/api/v1/posts/${postId}`)
      .send({ content: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('should return 403 if not the author', async () => {
    const otherToken = makeToken(otherUserId, 'other');
    const res = await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ content: 'Hijack' });
    expect(res.status).toBe(403);
  });

  it('should return 404 for non-existent post', async () => {
    const res = await request(app)
      .put('/api/v1/posts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('should return 400 for empty body (no fields to update)', async () => {
    const res = await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should return 400 for content > 2000 chars', async () => {
    const res = await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'A'.repeat(2001) });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/v1/posts/:id', () => {
  let postId: string;

  beforeEach(async () => {
    const [post] = await db('posts')
      .insert({
        user_id: userId,
        content: 'Post to delete',
        visibility: 'PUBLIC',
        moderation_status: 'APPROVED',
        is_scheduled: false,
        published_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id');
    postId = post.id ?? post;
  });

  it('should return 204 and soft-delete the post', async () => {
    const res = await request(app)
      .delete(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(204);
  });

  it('should make the post return 404 after deletion', async () => {
    await request(app)
      .delete(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${authToken}`);

    const res = await request(app).get(`/api/v1/posts/${postId}`);
    expect(res.status).toBe(404);
  });

  it('should return 403 if not the author', async () => {
    const otherToken = makeToken(otherUserId, 'other');
    const res = await request(app)
      .delete(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app).delete(`/api/v1/posts/${postId}`);
    expect(res.status).toBe(401);
  });

  it('should return 404 for non-existent post', async () => {
    const res = await request(app)
      .delete('/api/v1/posts/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/posts/trending/hashtags', () => {
  beforeEach(async () => {
    await db('hashtags').insert([
      { tag: 'nodejs', post_count: 42, created_at: new Date() },
      { tag: 'typescript', post_count: 30, created_at: new Date() },
      { tag: 'javascript', post_count: 15, created_at: new Date() },
    ]);
  });

  it('should return trending hashtags sorted by post_count', async () => {
    const res = await request(app).get('/api/v1/posts/trending/hashtags');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].tag).toBe('nodejs');
  });

  it('should not require authentication', async () => {
    const res = await request(app).get('/api/v1/posts/trending/hashtags');
    expect(res.status).toBe(200);
  });

  it('should respect limit parameter', async () => {
    const res = await request(app).get('/api/v1/posts/trending/hashtags?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/posts/:id/history', () => {
  let postId: string;

  beforeEach(async () => {
    const [post] = await db('posts')
      .insert({
        user_id: userId,
        content: 'Latest content',
        visibility: 'PUBLIC',
        moderation_status: 'APPROVED',
        is_scheduled: false,
        published_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('id');
    postId = post.id ?? post;

    await db('post_edit_history').insert({
      post_id: postId,
      previous_content: 'Old content v1',
      edited_at: new Date(),
    });
  });

  it('should return edit history for the authenticated owner', async () => {
    const res = await request(app)
      .get(`/api/v1/posts/${postId}/history`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].previous_content).toBe('Old content v1');
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app).get(`/api/v1/posts/${postId}/history`);
    expect(res.status).toBe(401);
  });

  it('should return 404 for non-existent post', async () => {
    const res = await request(app)
      .get('/api/v1/posts/00000000-0000-0000-0000-000000000000/history')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Health endpoints', () => {
  it('GET /health should return 200 with service info', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('post-service');
  });

  it('GET /health/ready should return 200 when DB and Redis are available', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks).toMatchObject({ database: 'ok', redis: 'ok' });
  });
});
