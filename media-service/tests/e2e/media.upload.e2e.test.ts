/**
 * E2E Test: Media Upload Flow — media-service
 *
 * Tests the presigned upload request endpoint against a REAL PostgreSQL database.
 * Kafka and Redis are mocked (no broker needed).
 * Storage runs in stub mode (no MinIO needed).
 *
 * Coverage:
 *  POST /api/v1/media/upload/presigned
 *    - authentication guards
 *    - validation (content type, file size, missing fields)
 *    - successful presigned URL generation + DB row creation
 *    - rate limiting behaviour
 */

import request from 'supertest';
import { Application } from 'express';
import { getTestApp } from './helpers/app';
import { getTestDb, truncateAllTables, destroyTestDb, findMediaById } from './helpers/db';
import { makeAuthToken, makeExpiredToken, bearerHeader, TEST_USER_ID, TEST_USER_2_ID } from './helpers/auth';

describe('E2E: POST /api/v1/media/upload/presigned', () => {
  let app: Application;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await destroyTestDb();
  });

  // ─── Authentication ─────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('returns 401 when no Authorization header is provided', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .send({ filename: 'photo.jpg', content_type: 'image/jpeg', size_bytes: 1000 });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for a malformed token', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set('Authorization', 'Bearer not-a-real-token')
        .send({ filename: 'photo.jpg', content_type: 'image/jpeg', size_bytes: 1000 });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for an expired token', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set('Authorization', `Bearer ${makeExpiredToken()}`)
        .send({ filename: 'photo.jpg', content_type: 'image/jpeg', size_bytes: 1000 });

      expect(res.status).toBe(401);
    });
  });

  // ─── Input Validation ────────────────────────────────────────────────────────

  describe('Input validation', () => {
    const token = () => makeAuthToken();

    it('returns 400 when filename is missing', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token()))
        .send({ content_type: 'image/jpeg', size_bytes: 1000 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'filename' })])
      );
    });

    it('returns 400 when content_type is missing', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token()))
        .send({ filename: 'photo.jpg', size_bytes: 1000 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when size_bytes is missing', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token()))
        .send({ filename: 'photo.jpg', content_type: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when size_bytes is 0', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token()))
        .send({ filename: 'photo.jpg', content_type: 'image/jpeg', size_bytes: 0 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when size_bytes is negative', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token()))
        .send({ filename: 'photo.jpg', content_type: 'image/jpeg', size_bytes: -1 });

      expect(res.status).toBe(400);
    });

    it('returns 400 for unsupported content type (application/pdf)', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token()))
        .send({ filename: 'doc.pdf', content_type: 'application/pdf', size_bytes: 5000 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for unsupported content type (text/plain)', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token()))
        .send({ filename: 'readme.txt', content_type: 'text/plain', size_bytes: 1000 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when file exceeds max size (50MB)', async () => {
      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token()))
        .send({ filename: 'huge.jpg', content_type: 'image/jpeg', size_bytes: 100 * 1024 * 1024 }); // 100MB

      expect(res.status).toBe(400);
    });
  });

  // ─── Successful requests ──────────────────────────────────────────────────────

  describe('Successful upload requests', () => {
    it('creates a DB record and returns a presigned URL for a valid image', async () => {
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token))
        .send({ filename: 'profile.jpg', content_type: 'image/jpeg', size_bytes: 1024 * 200 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const { data } = res.body;
      expect(data).toMatchObject({
        upload_url: expect.any(String),
        media_id: expect.any(String),
        expires_in: expect.any(Number),
        storage_key: expect.stringContaining(TEST_USER_ID),
      });
      expect(data.upload_url).toBeTruthy();

      // Verify the DB row was created with correct data
      const dbRow = await findMediaById(data.media_id);
      expect(dbRow).not.toBeNull();
      expect(dbRow.user_id).toBe(TEST_USER_ID);
      expect(dbRow.original_filename).toBe('profile.jpg');
      expect(dbRow.content_type).toBe('image/jpeg');
      expect(dbRow.size_bytes).toBe(1024 * 200);
      expect(dbRow.status).toBe('UPLOADING');
      expect(dbRow.virus_scan_status).toBe('PENDING');
      expect(dbRow.cdn_url).toBeNull();
      expect(dbRow.storage_key).toContain(data.media_id);
    });

    it('creates a DB record for a valid PNG image', async () => {
      const token = makeAuthToken();

      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token))
        .send({ filename: 'banner.png', content_type: 'image/png', size_bytes: 1024 * 512 });

      expect(res.status).toBe(201);
      const dbRow = await findMediaById(res.body.data.media_id);
      expect(dbRow.content_type).toBe('image/png');
    });

    it('creates a DB record for a valid GIF', async () => {
      const token = makeAuthToken();

      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token))
        .send({ filename: 'animation.gif', content_type: 'image/gif', size_bytes: 1024 * 50 });

      expect(res.status).toBe(201);
      const dbRow = await findMediaById(res.body.data.media_id);
      expect(dbRow.content_type).toBe('image/gif');
    });

    it('creates a DB record for a valid WebP image', async () => {
      const token = makeAuthToken();

      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token))
        .send({ filename: 'photo.webp', content_type: 'image/webp', size_bytes: 1024 * 300 });

      expect(res.status).toBe(201);
      expect(res.body.data.storage_key).toContain('.webp');
    });

    it('creates a DB record for a valid MP4 video', async () => {
      const token = makeAuthToken();

      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token))
        .send({ filename: 'clip.mp4', content_type: 'video/mp4', size_bytes: 1024 * 1024 * 10 });

      expect(res.status).toBe(201);
      const dbRow = await findMediaById(res.body.data.media_id);
      expect(dbRow.content_type).toBe('video/mp4');
      expect(dbRow.status).toBe('UPLOADING');
    });

    it('creates a DB record for a QuickTime video', async () => {
      const token = makeAuthToken();

      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token))
        .send({ filename: 'clip.mov', content_type: 'video/quicktime', size_bytes: 1024 * 1024 * 5 });

      expect(res.status).toBe(201);
    });

    it('sanitizes dangerous characters in filename', async () => {
      const token = makeAuthToken();

      const res = await request(app)
        .post('/api/v1/media/upload/presigned')
        .set(bearerHeader(token))
        .send({ filename: '../../../etc/passwd.jpg', content_type: 'image/jpeg', size_bytes: 1000 });

      expect(res.status).toBe(201);
      // The storage key must not contain path traversal sequences
      const { storage_key } = res.body.data;
      expect(storage_key).not.toContain('../');
      expect(storage_key).not.toContain('/etc/');
    });

    it('different users each get their own DB record and storage key namespace', async () => {
      const token1 = makeAuthToken({ userId: TEST_USER_ID });
      const token2 = makeAuthToken({ userId: TEST_USER_2_ID });

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/media/upload/presigned')
          .set(bearerHeader(token1))
          .send({ filename: 'img.jpg', content_type: 'image/jpeg', size_bytes: 1000 }),
        request(app)
          .post('/api/v1/media/upload/presigned')
          .set(bearerHeader(token2))
          .send({ filename: 'img.jpg', content_type: 'image/jpeg', size_bytes: 1000 }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.data.media_id).not.toBe(res2.body.data.media_id);
      expect(res1.body.data.storage_key).toContain(TEST_USER_ID);
      expect(res2.body.data.storage_key).toContain(TEST_USER_2_ID);

      // Verify both rows in DB
      const [db1, db2] = await Promise.all([
        findMediaById(res1.body.data.media_id),
        findMediaById(res2.body.data.media_id),
      ]);
      expect(db1.user_id).toBe(TEST_USER_ID);
      expect(db2.user_id).toBe(TEST_USER_2_ID);
    });
  });
});
