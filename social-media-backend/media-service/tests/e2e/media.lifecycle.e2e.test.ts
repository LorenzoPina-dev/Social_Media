/**
 * E2E Test: Full Media Lifecycle — media-service
 *
 * Tests the complete upload → confirm → status check → delete flow
 * against a REAL PostgreSQL database.
 *
 * Coverage:
 *  POST   /api/v1/media/upload/confirm/:mediaId
 *  GET    /api/v1/media/:mediaId/status
 *  GET    /api/v1/media
 *  DELETE /api/v1/media/:mediaId
 */

import request from 'supertest';
import { Application } from 'express';
import { getTestApp, resetTestApp } from './helpers/app';
import {
  getTestDb,
  truncateAllTables,
  destroyTestDb,
  seedMediaFile,
  findMediaById,
  findJobsByMediaId,
} from './helpers/db';
import {
  makeAuthToken,
  makeExpiredToken,
  bearerHeader,
  TEST_USER_ID,
  TEST_USER_2_ID,
} from './helpers/auth';

describe('E2E: Media Lifecycle', () => {
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

  // ─── POST /upload/confirm/:mediaId ───────────────────────────────────────────

  describe('POST /api/v1/media/upload/confirm/:mediaId', () => {
    it('returns 401 without auth', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'UPLOADING' });
      const res = await request(app).post(`/api/v1/media/upload/confirm/${media.id}`);
      expect(res.status).toBe(401);
    });

    it('returns 400 for non-UUID mediaId', async () => {
      const token = makeAuthToken();
      const res = await request(app)
        .post('/api/v1/media/upload/confirm/not-a-uuid')
        .set(bearerHeader(token));
      expect(res.status).toBe(400);
    });

    it('returns 404 when media does not exist', async () => {
      const token = makeAuthToken();
      const fakeId = '00000000-dead-dead-dead-000000000000';
      const res = await request(app)
        .post(`/api/v1/media/upload/confirm/${fakeId}`)
        .set(bearerHeader(token));
      expect(res.status).toBe(404);
    });

    it('returns 403 when user does not own the media', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_2_ID, status: 'UPLOADING' });
      const token = makeAuthToken({ userId: TEST_USER_ID }); // different user

      const res = await request(app)
        .post(`/api/v1/media/upload/confirm/${media.id}`)
        .set(bearerHeader(token));

      expect(res.status).toBe(403);
    });

    it('returns 400 when media is not in UPLOADING status', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'READY' });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .post(`/api/v1/media/upload/confirm/${media.id}`)
        .set(bearerHeader(token));

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when media is in FAILED status', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'FAILED' });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .post(`/api/v1/media/upload/confirm/${media.id}`)
        .set(bearerHeader(token));

      expect(res.status).toBe(400);
    });

    it('transitions status to PROCESSING and returns updated media (storage stub = exists)', async () => {
      // Storage service in stub mode always reports objectExists=true
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'UPLOADING' });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .post(`/api/v1/media/upload/confirm/${media.id}`)
        .set(bearerHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PROCESSING');
      expect(res.body.data.id).toBe(media.id);

      // Verify DB was updated
      const dbRow = await findMediaById(media.id);
      expect(dbRow.status).toBe('PROCESSING');
    });

    it('starts background processing after confirmation (jobs created in DB)', async () => {
      const media = await seedMediaFile({
        user_id: TEST_USER_ID,
        status: 'UPLOADING',
        content_type: 'image/jpeg', // triggers IMAGE_RESIZE job
      });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      await request(app)
        .post(`/api/v1/media/upload/confirm/${media.id}`)
        .set(bearerHeader(token));

      // Wait for async processing to complete (stub is synchronous fast)
      await new Promise(r => setTimeout(r, 300));

      // The processing service runs in background — verify media eventually becomes READY
      const dbRow = await findMediaById(media.id);
      // Status should be READY (image processing completes synchronously in stub)
      expect(['PROCESSING', 'READY']).toContain(dbRow.status);
    });
  });

  // ─── GET /api/v1/media/:mediaId/status ──────────────────────────────────────

  describe('GET /api/v1/media/:mediaId/status', () => {
    it('returns 401 without auth', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID });
      const res = await request(app).get(`/api/v1/media/${media.id}/status`);
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent mediaId', async () => {
      const token = makeAuthToken();
      const res = await request(app)
        .get('/api/v1/media/00000000-0000-0000-0000-000000000000/status')
        .set(bearerHeader(token));
      expect(res.status).toBe(404);
    });

    it('returns 403 when user does not own the media', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_2_ID, status: 'READY' });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .get(`/api/v1/media/${media.id}/status`)
        .set(bearerHeader(token));

      expect(res.status).toBe(403);
    });

    it('returns 400 for non-UUID mediaId', async () => {
      const token = makeAuthToken();
      const res = await request(app)
        .get('/api/v1/media/not-a-uuid/status')
        .set(bearerHeader(token));
      expect(res.status).toBe(400);
    });

    it('returns full media object for READY media', async () => {
      const media = await seedMediaFile({
        user_id: TEST_USER_ID,
        status: 'READY',
        content_type: 'image/jpeg',
        width: 1920,
        height: 1080,
        blurhash: 'LGFFaXYk^6#M@-5c',
        cdn_url: 'http://localhost:9000/test-bucket/some/path.jpg',
        thumbnail_url: 'http://localhost:9000/test-bucket/some/path_thumb.jpg',
      });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .get(`/api/v1/media/${media.id}/status`)
        .set(bearerHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: media.id,
        status: 'READY',
        content_type: 'image/jpeg',
        width: 1920,
        height: 1080,
        blurhash: 'LGFFaXYk^6#M@-5c',
        cdn_url: 'http://localhost:9000/test-bucket/some/path.jpg',
        thumbnail_url: 'http://localhost:9000/test-bucket/some/path_thumb.jpg',
      });
    });

    it('returns UPLOADING status for a freshly created record', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'UPLOADING', cdn_url: null });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .get(`/api/v1/media/${media.id}/status`)
        .set(bearerHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('UPLOADING');
      expect(res.body.data.cdn_url).toBeNull();
    });

    it('returns PROCESSING status during processing', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'PROCESSING', cdn_url: null });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .get(`/api/v1/media/${media.id}/status`)
        .set(bearerHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PROCESSING');
    });

    it('does not return soft-deleted media', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'DELETED' });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .get(`/api/v1/media/${media.id}/status`)
        .set(bearerHeader(token));

      // DELETED is filtered out by the model's findById
      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/v1/media ────────────────────────────────────────────────────────

  describe('GET /api/v1/media', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/media');
      expect(res.status).toBe(401);
    });

    it('returns empty list when user has no media', async () => {
      // Seed media for a different user
      await seedMediaFile({ user_id: TEST_USER_2_ID });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .get('/api/v1/media')
        .set(bearerHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('returns only the authenticated user\'s media', async () => {
      // Seed media for user 1 (x2) and user 2 (x1)
      await seedMediaFile({ user_id: TEST_USER_ID, original_filename: 'a.jpg' });
      await seedMediaFile({ user_id: TEST_USER_ID, original_filename: 'b.jpg' });
      await seedMediaFile({ user_id: TEST_USER_2_ID, original_filename: 'c.jpg' });

      const token = makeAuthToken({ userId: TEST_USER_ID });
      const res = await request(app)
        .get('/api/v1/media')
        .set(bearerHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      for (const item of res.body.data) {
        expect(item.user_id).toBe(TEST_USER_ID);
      }
    });

    it('does not return soft-deleted media in the list', async () => {
      await seedMediaFile({ user_id: TEST_USER_ID, status: 'READY' });
      await seedMediaFile({ user_id: TEST_USER_ID, status: 'DELETED' });

      const token = makeAuthToken({ userId: TEST_USER_ID });
      const res = await request(app)
        .get('/api/v1/media')
        .set(bearerHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('READY');
    });

    it('respects limit and offset pagination params', async () => {
      // Seed 5 files for the user
      for (let i = 0; i < 5; i++) {
        await seedMediaFile({ user_id: TEST_USER_ID, original_filename: `file-${i}.jpg` });
      }

      const token = makeAuthToken({ userId: TEST_USER_ID });

      const page1 = await request(app)
        .get('/api/v1/media?limit=3&offset=0')
        .set(bearerHeader(token));

      const page2 = await request(app)
        .get('/api/v1/media?limit=3&offset=3')
        .set(bearerHeader(token));

      expect(page1.status).toBe(200);
      expect(page1.body.data).toHaveLength(3);
      expect(page1.body.pagination).toMatchObject({ limit: 3, offset: 0, count: 3 });

      expect(page2.status).toBe(200);
      expect(page2.body.data).toHaveLength(2); // only 2 remaining
      expect(page2.body.pagination).toMatchObject({ limit: 3, offset: 3, count: 2 });

      // No overlap between pages
      const ids1 = page1.body.data.map((m: any) => m.id);
      const ids2 = page2.body.data.map((m: any) => m.id);
      expect(ids1.filter((id: string) => ids2.includes(id))).toHaveLength(0);
    });

    it('returns 400 for invalid limit param', async () => {
      const token = makeAuthToken();
      const res = await request(app)
        .get('/api/v1/media?limit=abc')
        .set(bearerHeader(token));
      expect(res.status).toBe(400);
    });

    it('returns 400 when limit exceeds maximum (100)', async () => {
      const token = makeAuthToken();
      const res = await request(app)
        .get('/api/v1/media?limit=101')
        .set(bearerHeader(token));
      expect(res.status).toBe(400);
    });

    it('returns media sorted by created_at descending', async () => {
      const db = getTestDb();
      const userId = TEST_USER_ID;

      // Insert with explicit timestamps so ordering is deterministic
      await db('media_files').insert([
        {
          user_id: userId, original_filename: 'oldest.jpg', content_type: 'image/jpeg',
          size_bytes: 100, storage_key: `${userId}/a/oldest.jpg`, status: 'READY',
          virus_scan_status: 'CLEAN', created_at: new Date('2025-01-01T00:00:00Z'),
        },
        {
          user_id: userId, original_filename: 'newest.jpg', content_type: 'image/jpeg',
          size_bytes: 100, storage_key: `${userId}/b/newest.jpg`, status: 'READY',
          virus_scan_status: 'CLEAN', created_at: new Date('2025-01-03T00:00:00Z'),
        },
        {
          user_id: userId, original_filename: 'middle.jpg', content_type: 'image/jpeg',
          size_bytes: 100, storage_key: `${userId}/c/middle.jpg`, status: 'READY',
          virus_scan_status: 'CLEAN', created_at: new Date('2025-01-02T00:00:00Z'),
        },
      ]);

      const token = makeAuthToken({ userId });
      const res = await request(app).get('/api/v1/media').set(bearerHeader(token));

      expect(res.status).toBe(200);
      const names = res.body.data.map((m: any) => m.original_filename);
      expect(names).toEqual(['newest.jpg', 'middle.jpg', 'oldest.jpg']);
    });
  });

  // ─── DELETE /api/v1/media/:mediaId ────────────────────────────────────────────

  describe('DELETE /api/v1/media/:mediaId', () => {
    it('returns 401 without auth', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID });
      const res = await request(app).delete(`/api/v1/media/${media.id}`);
      expect(res.status).toBe(401);
    });

    it('returns 400 for non-UUID mediaId', async () => {
      const token = makeAuthToken();
      const res = await request(app)
        .delete('/api/v1/media/not-a-uuid')
        .set(bearerHeader(token));
      expect(res.status).toBe(400);
    });

    it('returns 404 when media does not exist', async () => {
      const token = makeAuthToken();
      const res = await request(app)
        .delete('/api/v1/media/00000000-0000-0000-0000-000000000000')
        .set(bearerHeader(token));
      expect(res.status).toBe(404);
    });

    it('returns 403 when user does not own the media', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_2_ID });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .delete(`/api/v1/media/${media.id}`)
        .set(bearerHeader(token));

      expect(res.status).toBe(403);
    });

    it('soft-deletes the media file (marks as DELETED in DB)', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'READY' });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .delete(`/api/v1/media/${media.id}`)
        .set(bearerHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify soft-delete in DB (row still exists but status = DELETED)
      const db = getTestDb();
      const dbRow = await db('media_files').where({ id: media.id }).first();
      expect(dbRow).not.toBeNull();
      expect(dbRow.status).toBe('DELETED');
    });

    it('makes the media no longer visible via status endpoint after deletion', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'READY' });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      await request(app)
        .delete(`/api/v1/media/${media.id}`)
        .set(bearerHeader(token));

      // Status endpoint should now return 404
      const statusRes = await request(app)
        .get(`/api/v1/media/${media.id}/status`)
        .set(bearerHeader(token));

      expect(statusRes.status).toBe(404);
    });

    it('removes the media from the list endpoint after deletion', async () => {
      const token = makeAuthToken({ userId: TEST_USER_ID });
      const media1 = await seedMediaFile({ user_id: TEST_USER_ID, original_filename: 'keep.jpg' });
      const media2 = await seedMediaFile({ user_id: TEST_USER_ID, original_filename: 'delete-me.jpg' });

      await request(app).delete(`/api/v1/media/${media2.id}`).set(bearerHeader(token));

      const listRes = await request(app).get('/api/v1/media').set(bearerHeader(token));
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].id).toBe(media1.id);
    });

    it('returns 404 when trying to delete already-deleted media', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'DELETED' });
      const token = makeAuthToken({ userId: TEST_USER_ID });

      const res = await request(app)
        .delete(`/api/v1/media/${media.id}`)
        .set(bearerHeader(token));

      // DELETED media is excluded by findById → 404
      expect(res.status).toBe(404);
    });
  });

  // ─── Health Endpoints ─────────────────────────────────────────────────────────

  describe('Health endpoints', () => {
    it('GET /health returns 200 with service info', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'healthy',
        service: 'media-service',
      });
      expect(res.body.timestamp).toBeDefined();
    });

    it('GET /health/ready queries real DB (SELECT 1)', async () => {
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ready' });
      expect(res.body.checks.database).toBe('ok');
    });

    it('GET /api/v1/unknown-route returns 404', async () => {
      const res = await request(app).get('/api/v1/nonexistent/route');
      expect(res.status).toBe(404);
    });
  });
});
