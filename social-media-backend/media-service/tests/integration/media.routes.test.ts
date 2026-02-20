/**
 * Integration tests — Media API routes
 *
 * Tests the full Express app with all infrastructure mocked:
 * - Database: mocked Knex chain
 * - Redis: in-memory stub
 * - Kafka: no-op
 * - StorageService: in-memory stub
 *
 * Verifies routing, middleware (auth, validation, rate-limiting), and
 * controller-to-service wiring without touching real infrastructure.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Application } from 'express';

// ─── Infrastructure mocks ──────────────────────────────────────────────────────

/**
 * Knex mock: getDatabase() returns a callable function that also has
 * all chainable query builder methods. Both `db('table').insert()` and
 * `db.raw()` must work.
 */
jest.mock('../../src/config/database', () => {
  const buildMockDb = () => {
    const db: any = jest.fn(() => db);     // db('table') returns db itself
    db.where       = jest.fn().mockReturnValue(db);
    db.whereNot    = jest.fn().mockReturnValue(db);
    db.whereNull   = jest.fn().mockReturnValue(db);
    db.whereIn     = jest.fn().mockReturnValue(db);
    db.first       = jest.fn().mockResolvedValue(null);
    db.insert      = jest.fn().mockReturnValue(db);
    db.returning   = jest.fn().mockResolvedValue([]);
    db.update      = jest.fn().mockReturnValue(db);
    db.orderBy     = jest.fn().mockReturnValue(db);
    db.limit       = jest.fn().mockReturnValue(db);
    db.offset      = jest.fn().mockResolvedValue([]);
    db.delete      = jest.fn().mockResolvedValue(1);
    db.count       = jest.fn().mockReturnValue(db);
    db.raw         = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    db.select      = jest.fn().mockReturnValue(db);
    return db;
  };

  const mockDb = buildMockDb();

  return {
    connectDatabase: jest.fn().mockResolvedValue(undefined),
    getDatabase: jest.fn().mockReturnValue(mockDb),
    disconnectDatabase: jest.fn().mockResolvedValue(undefined),
    db: null,
  };
});

jest.mock('../../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  getRedisClient: jest.fn().mockReturnValue({
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(undefined),
  }),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
  redisClient: null,
}));

jest.mock('../../src/config/kafka', () => ({
  connectKafka: jest.fn().mockResolvedValue(undefined),
  getKafkaProducer: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue(undefined),
  }),
  disconnectKafka: jest.fn().mockResolvedValue(undefined),
  registerKafkaHandler: jest.fn(),
}));

jest.mock('../../src/services/storage.service', () => ({
  StorageService: jest.fn().mockImplementation(() => ({
    generatePresignedPutUrl: jest.fn().mockResolvedValue('https://stub-storage.local/upload'),
    objectExists: jest.fn().mockResolvedValue(true),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    buildCdnUrl: jest.fn((key: string) => `https://cdn.local/${key}`),
  })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret';
process.env.JWT_ACCESS_SECRET = JWT_SECRET;

function makeToken(userId = 'user-test-123'): string {
  return jwt.sign(
    {
      userId,
      username: 'testuser',
      email: 'test@example.com',
      verified: true,
      mfa_enabled: false,
      jti: `jti-${Date.now()}`,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function makeExpiredToken(): string {
  return jwt.sign(
    { userId: 'user-1', username: 'x', email: 'x@x.com', verified: true, mfa_enabled: false, jti: 'j' },
    JWT_SECRET,
    { expiresIn: '-1s' },
  );
}

// Helper: get the shared mock DB from the module
function getMockDb() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/config/database').getDatabase();
}

// Helper: build a fake media row
function fakeMedia(overrides: Record<string, unknown> = {}) {
  return {
    id: 'media-uuid-1',
    user_id: 'user-test-123',
    original_filename: 'photo.jpg',
    content_type: 'image/jpeg',
    size_bytes: 5000,
    storage_key: 'user-test-123/media-uuid-1/photo.jpg',
    cdn_url: null,
    thumbnail_url: null,
    blurhash: null,
    width: null,
    height: null,
    duration_seconds: null,
    status: 'UPLOADING',
    virus_scan_status: 'PENDING',
    created_at: new Date(),
    processed_at: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Media API — Integration (mocked infra)', () => {
  let app: Application;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-wire chainable returns after clearAllMocks
    const db = getMockDb();
    db.mockReturnValue(db);
    db.where.mockReturnValue(db);
    db.whereNot.mockReturnValue(db);
    db.whereNull.mockReturnValue(db);
    db.whereIn.mockReturnValue(db);
    db.first.mockResolvedValue(null);
    db.insert.mockReturnValue(db);
    db.returning.mockResolvedValue([]);
    db.update.mockReturnValue(db);
    db.orderBy.mockReturnValue(db);
    db.limit.mockReturnValue(db);
    db.offset.mockResolvedValue([]);
    db.raw.mockResolvedValue([{ '?column?': 1 }]);
    db.count.mockReturnValue(db);
    db.select.mockReturnValue(db);
  });

  // ─── Health ────────────────────────────────────────────────────────────────

  describe('Health endpoints', () => {
    it('GET /health → 200 with service info', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.service).toBe('media-service');
      expect(res.body.status).toBe('healthy');
    });

    it('GET /health/ready → 200 when DB and Redis respond', async () => {
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
    });
  });

  // ─── Auth guard ────────────────────────────────────────────────────────────

  describe('Authentication guard', () => {
    it('returns 401 when no Authorization header', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .send({ filename: 'a.jpg', content_type: 'image/jpeg', size_bytes: 1000 });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for malformed token', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set('Authorization', 'Bearer not-valid')
        .send({ filename: 'a.jpg', content_type: 'image/jpeg', size_bytes: 1000 });
      expect(res.status).toBe(401);
    });

    it('returns 401 for expired token', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set('Authorization', `Bearer ${makeExpiredToken()}`)
        .send({ filename: 'a.jpg', content_type: 'image/jpeg', size_bytes: 1000 });
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /upload/presigned ────────────────────────────────────────────────

  describe('POST /api/v1/media/upload/presigned', () => {
    it('returns 400 for missing filename', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ content_type: 'image/jpeg', size_bytes: 1000 });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing content_type', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ filename: 'a.jpg', size_bytes: 1000 });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing size_bytes', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ filename: 'a.jpg', content_type: 'image/jpeg' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for size_bytes = 0 (Joi min: 1)', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ filename: 'a.jpg', content_type: 'image/jpeg', size_bytes: 0 });
      expect(res.status).toBe(400);
    });

    it('returns 400 for unsupported content type', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ filename: 'doc.pdf', content_type: 'application/pdf', size_bytes: 5000 });
      expect(res.status).toBe(400);
    });

    it('returns 201 with presigned URL for valid image upload request', async () => {
      const db = getMockDb();
      const created = fakeMedia();
      db.returning.mockResolvedValue([created]);

      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ filename: 'photo.jpg', content_type: 'image/jpeg', size_bytes: 5000 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        upload_url: expect.any(String),
        media_id: expect.any(String),
        expires_in: expect.any(Number),
        storage_key: expect.any(String),
      });
    });

    it('returns 201 for video/mp4', async () => {
      const db = getMockDb();
      db.returning.mockResolvedValue([fakeMedia({ content_type: 'video/mp4' })]);

      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ filename: 'clip.mp4', content_type: 'video/mp4', size_bytes: 1024 * 1024 });

      expect(res.status).toBe(201);
    });
  });

  // ─── POST /upload/confirm/:mediaId ────────────────────────────────────────

  describe('POST /api/v1/media/upload/confirm/:mediaId', () => {
    const validId = '00000000-0000-0000-0000-000000000001';

    it('returns 400 for non-UUID mediaId', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/confirm/not-a-uuid')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(400);
    });

    it('returns 404 when media does not exist', async () => {
      const db = getMockDb();
      db.first.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/v1/media/upload/confirm/${validId}`)
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(404);
    });

    it('returns 403 when user does not own the media', async () => {
      const db = getMockDb();
      db.first.mockResolvedValue(fakeMedia({ user_id: 'other-user' }));

      const res = await request(app)
        .post(`/api/v1/media/upload/confirm/${validId}`)
        .set('Authorization', `Bearer ${makeToken('requester-user')}`);
      expect(res.status).toBe(403);
    });

    it('returns 400 when media is not in UPLOADING status', async () => {
      const db = getMockDb();
      db.first.mockResolvedValue(fakeMedia({ user_id: 'user-test-123', status: 'READY' }));

      const res = await request(app)
        .post(`/api/v1/media/upload/confirm/${validId}`)
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(400);
    });

    it('returns 200 on successful confirm', async () => {
      const db = getMockDb();
      const media = fakeMedia({ user_id: 'user-test-123', status: 'UPLOADING' });
      const processing = fakeMedia({ user_id: 'user-test-123', status: 'PROCESSING' });

      db.first.mockResolvedValue(media);
      db.returning.mockResolvedValue([processing]);

      const res = await request(app)
        .post(`/api/v1/media/upload/confirm/${validId}`)
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── GET /api/v1/media/:mediaId/status ────────────────────────────────────

  describe('GET /api/v1/media/:mediaId/status', () => {
    const validId = '00000000-0000-0000-0000-000000000001';

    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/api/v1/media/${validId}/status`);
      expect(res.status).toBe(401);
    });

    it('returns 400 for non-UUID id', async () => {
      const res = await request(app)
        .get('/api/v1/media/not-a-uuid/status')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent media', async () => {
      const db = getMockDb();
      db.first.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/media/${validId}/status`)
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(404);
    });

    it('returns 200 with media data for existing owned media', async () => {
      const db = getMockDb();
      db.first.mockResolvedValue(fakeMedia({ user_id: 'user-test-123', status: 'READY' }));

      const res = await request(app)
        .get(`/api/v1/media/${validId}/status`)
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('READY');
    });

    it('returns 403 for media owned by another user', async () => {
      const db = getMockDb();
      db.first.mockResolvedValue(fakeMedia({ user_id: 'another-user', status: 'READY' }));

      const res = await request(app)
        .get(`/api/v1/media/${validId}/status`)
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/v1/media ─────────────────────────────────────────────────────

  describe('GET /api/v1/media', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/media');
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid limit', async () => {
      const res = await request(app)
        .get('/api/v1/media?limit=abc')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(400);
    });

    it('returns 400 when limit exceeds 100', async () => {
      const res = await request(app)
        .get('/api/v1/media?limit=200')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(400);
    });

    it('returns 200 with empty list', async () => {
      const db = getMockDb();
      db.offset.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/media?limit=10&offset=0')
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns pagination metadata', async () => {
      const db = getMockDb();
      db.offset.mockResolvedValue([fakeMedia(), fakeMedia()]);

      const res = await request(app)
        .get('/api/v1/media?limit=5&offset=10')
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination).toMatchObject({ limit: 5, offset: 10 });
    });
  });

  // ─── DELETE /api/v1/media/:mediaId ────────────────────────────────────────

  describe('DELETE /api/v1/media/:mediaId', () => {
    const validId = '00000000-0000-0000-0000-000000000001';

    it('returns 401 without auth', async () => {
      const res = await request(app).delete(`/api/v1/media/${validId}`);
      expect(res.status).toBe(401);
    });

    it('returns 400 for non-UUID mediaId', async () => {
      const res = await request(app)
        .delete('/api/v1/media/not-a-uuid')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(400);
    });

    it('returns 404 when media does not exist', async () => {
      const db = getMockDb();
      db.first.mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/v1/media/${validId}`)
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(404);
    });

    it('returns 403 when user does not own the media', async () => {
      const db = getMockDb();
      db.first.mockResolvedValue(fakeMedia({ user_id: 'other-user' }));

      const res = await request(app)
        .delete(`/api/v1/media/${validId}`)
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(403);
    });

    it('returns 200 on successful delete', async () => {
      const db = getMockDb();
      db.first.mockResolvedValue(fakeMedia({ user_id: 'user-test-123', status: 'READY' }));
      db.returning.mockResolvedValue([fakeMedia({ status: 'DELETED' })]);

      const res = await request(app)
        .delete(`/api/v1/media/${validId}`)
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── 404 catch-all ────────────────────────────────────────────────────────

  describe('404 handler', () => {
    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns 404 for unknown nested routes', async () => {
      const res = await request(app).get('/api/v2/media');
      expect(res.status).toBe(404);
    });
  });
});
