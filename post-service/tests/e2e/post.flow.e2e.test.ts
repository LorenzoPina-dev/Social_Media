/**
 * E2E Tests — Post Service Complete Flows
 *
 * Testa flussi completi end-to-end:
 * - Creazione, lettura, modifica, cancellazione
 * - Paginazione post utente
 * - Hashtag trending
 * - Post schedulati
 * - Storia delle edizioni
 *
 * Kafka è mockato. DB e Redis sono reali.
 */

import request from 'supertest';
import { Application } from 'express';
import knex, { Knex } from 'knex';
import jwt from 'jsonwebtoken';

// ─── Mock Kafka ───────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-min-32-chars-long!!';

function makeToken(userId: string, username = 'testuser'): string {
  return jwt.sign(
    { userId, username, email: `${username}@test.com`, verified: true, mfa_enabled: false, jti: `jti-${userId}` },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: Application;
let db: Knex;
let scheduler: SchedulerService;

const userA = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  token: makeToken('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'usera'),
};
const userB = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  token: makeToken('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'userb'),
};

beforeAll(async () => {
  db = knex({
    client: 'postgresql',
    connection:
      process.env.TEST_DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/post_test_db',
    pool: { min: 1, max: 5 },
    migrations: { directory: './migrations', extension: 'ts' },
  });

  // Migrazioni una sola volta
  await db.migrate.latest();

  const result = await createApp();
  app = result.app;
  scheduler = result.scheduler;
}, 30000);

beforeEach(async () => {
  await db.raw(`
    TRUNCATE post_edit_history, post_hashtags, hashtags, posts CASCADE
  `);
});

afterAll(async () => {
  // Stop scheduler e tutti i timer
  if (scheduler) {
    scheduler.stop(); // già presente
  }

  // Chiudi tutte le connessioni DB
  await db.destroy();
}, 30000);


// ─── E2E Flows ────────────────────────────────────────────────────────────────

describe('Flow 1: Post Lifecycle — Create → Read → Update → Delete', () => {
  it('should complete the full CRUD lifecycle of a post', async () => {
    // 1. Create
    const createRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: 'My first post #hello', visibility: 'PUBLIC' });

    expect(createRes.status).toBe(201);
    const postId = createRes.body.data.id;
    expect(postId).toBeDefined();
    expect(createRes.body.data.moderation_status).toBe('PENDING');

    // 2. Read (public — no auth needed)
    const getRes = await request(app).get(`/api/v1/posts/${postId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.content).toBe('My first post #hello');

    // 3. Update
    const updateRes = await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: 'Updated content #updated' });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.content).toBe('Updated content #updated');

    // 4. Verify edit history was created
    const historyRes = await request(app)
      .get(`/api/v1/posts/${postId}/history`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data).toHaveLength(1);
    expect(historyRes.body.data[0].previous_content).toBe('My first post #hello');

    // 5. Delete
    const deleteRes = await request(app)
      .delete(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(deleteRes.status).toBe(204);

    // 6. Verify post is gone
    const afterDeleteRes = await request(app).get(`/api/v1/posts/${postId}`);
    expect(afterDeleteRes.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 2: Privacy — PRIVATE post access control', () => {
  it('owner can create and read a PRIVATE post; others cannot', async () => {
    // 1. UserA creates a PRIVATE post
    const createRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: 'My private thoughts', visibility: 'PRIVATE' });

    expect(createRes.status).toBe(201);
    const postId = createRes.body.data.id;

    // 2. Owner can read it
    const ownerRes = await request(app)
      .get(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(ownerRes.status).toBe(200);

    // 3. Unauthenticated user cannot read it
    // GET /posts/:id uses optionalAuth (never 401); PRIVATE posts return 403 for everyone
    // without ownership — including unauthenticated users.
    const anonRes = await request(app).get(`/api/v1/posts/${postId}`);
    expect(anonRes.status).toBe(403);

    // 4. Another authenticated user cannot read it
    const otherRes = await request(app)
      .get(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(otherRes.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 3: Hashtag Trending — Multiple posts accumulate hashtag counts', () => {
  it('should accumulate hashtag counts across multiple posts and show trending', async () => {
    // Create 3 posts all with #nodejs, 2 with #typescript
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: '#nodejs is great' });
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: '#nodejs and #typescript together' });
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ content: '#nodejs #typescript #javascript' });

    // Check trending — nodejs should appear more
    const trendingRes = await request(app).get('/api/v1/posts/trending/hashtags?limit=10');

    expect(trendingRes.status).toBe(200);
    const tags = trendingRes.body.data as Array<{ tag: string; post_count: number }>;
    const nodejsTag = tags.find((t) => t.tag === 'nodejs');
    const tsTag = tags.find((t) => t.tag === 'typescript');

    expect(nodejsTag).toBeDefined();
    expect(nodejsTag!.post_count).toBe(3);
    expect(tsTag).toBeDefined();
    expect(tsTag!.post_count).toBe(2);

    // nodejs should be ranked higher than typescript
    const nodejsIdx = tags.findIndex((t) => t.tag === 'nodejs');
    const tsIdx = tags.findIndex((t) => t.tag === 'typescript');
    expect(nodejsIdx).toBeLessThan(tsIdx);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 4: User Post List — Pagination', () => {
  it('should paginate through user posts correctly', async () => {
    // Create 5 posts for userA
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ content: `Post number ${i + 1}` });
    }

    // Fetch first page (limit 3)
    const page1 = await request(app).get(
      `/api/v1/users/${userA.id}/posts?limit=3`,
    );
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(3);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.cursor).toBeDefined();

    // Fetch second page using cursor
    const page2 = await request(app).get(
      `/api/v1/users/${userA.id}/posts?limit=3&cursor=${page1.body.cursor}`,
    );
    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(2);
    expect(page2.body.hasMore).toBe(false);

    // Ensure no duplicate IDs across pages
    const page1Ids = page1.body.data.map((p: { id: string }) => p.id);
    const page2Ids = page2.body.data.map((p: { id: string }) => p.id);
    const allIds = [...page1Ids, ...page2Ids];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 5: Ownership Enforcement — Author-only operations', () => {
  it('userB cannot update or delete a post created by userA', async () => {
    // UserA creates a post
    const createRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: "UserA's post" });
    const postId = createRes.body.data.id;

    // UserB tries to update
    const updateRes = await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ content: 'Hijacked!' });
    expect(updateRes.status).toBe(403);

    // UserB tries to delete
    const deleteRes = await request(app)
      .delete(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(deleteRes.status).toBe(403);

    // Post should still be intact
    const getRes = await request(app).get(`/api/v1/posts/${postId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.content).toBe("UserA's post");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 6: Scheduled Posts', () => {
  it('should create a scheduled post that is not yet published', async () => {
    const futureDate = new Date(Date.now() + 86400_000).toISOString(); // 1 day from now

    const createRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: 'Tomorrow post #scheduled', scheduled_at: futureDate });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.is_scheduled).toBe(true);
    expect(createRes.body.data.published_at).toBeNull();
  });

  it('should reject scheduled post with past date', async () => {
    const pastDate = new Date(Date.now() - 3600_000).toISOString();

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: 'Past scheduled', scheduled_at: pastDate });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 7: Multiple Edits — History accumulation', () => {
  it('should accumulate multiple edit history entries', async () => {
    // Create post
    const createRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: 'Version 1' });
    const postId = createRes.body.data.id;

    // Edit twice
    await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: 'Version 2' });

    await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: 'Version 3' });

    // Check history has 2 entries
    const historyRes = await request(app)
      .get(`/api/v1/posts/${postId}/history`)
      .set('Authorization', `Bearer ${userA.token}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data).toHaveLength(2);

    // Most recent edit first (descending by edited_at)
    const contents = historyRes.body.data.map((h: { previous_content: string }) => h.previous_content);
    expect(contents).toContain('Version 1');
    expect(contents).toContain('Version 2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 8: Visibility change', () => {
  it('should allow owner to change post from PUBLIC to PRIVATE', async () => {
    const createRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ content: 'Initially public', visibility: 'PUBLIC' });
    const postId = createRes.body.data.id;

    // Visible to everyone before
    const beforeRes = await request(app).get(`/api/v1/posts/${postId}`);
    expect(beforeRes.status).toBe(200);

    // Change to PRIVATE
    await request(app)
      .put(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ visibility: 'PRIVATE' });

    // Now only owner can see it
    const afterAnonRes = await request(app).get(`/api/v1/posts/${postId}`);
    expect(afterAnonRes.status).toBe(403);

    const afterOwnerRes = await request(app)
      .get(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(afterOwnerRes.status).toBe(200);
  });
});
