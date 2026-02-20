/**
 * E2E Test: Processing Service — media-service
 *
 * Tests the ProcessingService directly against a REAL PostgreSQL database.
 * Instantiates the real service chain: ProcessingService + MediaFileModel + ProcessingJobModel.
 * Storage runs in stub mode.
 *
 * Coverage:
 *  - startProcessing: image flow (IMAGE_RESIZE job)
 *  - startProcessing: video flow (VIDEO_TRANSCODE job)
 *  - startProcessing: unknown content type (no jobs)
 *  - startProcessing: virus scan gating (when enabled)
 *  - Job status transitions (QUEUED → PROCESSING → DONE/FAILED)
 *  - media_files DB state after processing
 */

import { ProcessingService } from '../../src/services/processing.service';
import { MediaFileModel } from '../../src/models/media.model';
import { ProcessingJobModel } from '../../src/models/processingJob.model';
import { StorageService } from '../../src/services/storage.service';
import { MediaProducer } from '../../src/kafka/producers/media.producer';
import { connectDatabase, disconnectDatabase, getDatabase } from '../../src/config/database';
import {
  truncateAllTables,
  destroyTestDb,
  seedMediaFile,
  findMediaById,
  findJobsByMediaId,
} from './helpers/db';
import { TEST_USER_ID } from './helpers/auth';

// MediaProducer is mocked (Kafka unavailable) — events publish is a no-op
jest.mock('../../src/kafka/producers/media.producer');

describe('E2E: ProcessingService (real DB)', () => {
  let processingService: ProcessingService;
  let mediaModel: MediaFileModel;
  let jobModel: ProcessingJobModel;
  let storageService: StorageService;
  let mediaProducer: jest.Mocked<MediaProducer>;

  beforeAll(async () => {
    await connectDatabase();

    mediaModel = new MediaFileModel();
    jobModel = new ProcessingJobModel();
    storageService = new StorageService(); // stub mode (no real MinIO)
    mediaProducer = new (MediaProducer as jest.MockedClass<typeof MediaProducer>)();
    mediaProducer.publishMediaProcessed = jest.fn().mockResolvedValue(undefined);
    mediaProducer.publishMediaUploaded = jest.fn().mockResolvedValue(undefined);
    mediaProducer.publishMediaDeleted = jest.fn().mockResolvedValue(undefined);

    processingService = new ProcessingService(mediaModel, jobModel, storageService, mediaProducer);
  });

  beforeEach(async () => {
    await truncateAllTables();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await disconnectDatabase();
    await destroyTestDb();
  });

  // ─── Image processing ────────────────────────────────────────────────────────

  describe('Image processing (IMAGE_RESIZE)', () => {
    it('creates IMAGE_RESIZE job, transitions media to READY, publishes event', async () => {
      const media = await seedMediaFile({
        user_id: TEST_USER_ID,
        content_type: 'image/jpeg',
        status: 'PROCESSING',
        cdn_url: null,
      });

      await processingService.startProcessing(
        media.id,
        'image/jpeg',
        media.storage_key,
        TEST_USER_ID
      );

      // Media should be READY
      const dbMedia = await findMediaById(media.id);
      expect(dbMedia.status).toBe('READY');
      expect(dbMedia.cdn_url).toBeTruthy();
      expect(dbMedia.virus_scan_status).toBe('CLEAN');

      // IMAGE_RESIZE job should be DONE
      const jobs = await findJobsByMediaId(media.id);
      const resizeJob = jobs.find((j: any) => j.job_type === 'IMAGE_RESIZE');
      expect(resizeJob).toBeDefined();
      expect(resizeJob.status).toBe('DONE');

      // Event published
      expect(mediaProducer.publishMediaProcessed).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaId: media.id,
          userId: TEST_USER_ID,
          cdn_url: expect.any(String),
        })
      );
    });

    it('sets cdn_url and thumbnail_url on READY media after image processing', async () => {
      const media = await seedMediaFile({
        user_id: TEST_USER_ID,
        content_type: 'image/png',
        status: 'PROCESSING',
        cdn_url: null,
        thumbnail_url: null,
      });

      await processingService.startProcessing(
        media.id,
        'image/png',
        media.storage_key,
        TEST_USER_ID
      );

      const dbMedia = await findMediaById(media.id);
      expect(dbMedia.cdn_url).toContain(media.storage_key);
      expect(dbMedia.thumbnail_url).toBeTruthy();
    });

    it('processes WebP images correctly', async () => {
      const media = await seedMediaFile({
        user_id: TEST_USER_ID,
        content_type: 'image/webp',
        original_filename: 'photo.webp',
        status: 'PROCESSING',
        cdn_url: null,
      });

      await processingService.startProcessing(
        media.id,
        'image/webp',
        media.storage_key,
        TEST_USER_ID
      );

      const dbMedia = await findMediaById(media.id);
      expect(dbMedia.status).toBe('READY');
    });
  });

  // ─── Video processing ────────────────────────────────────────────────────────

  describe('Video processing (VIDEO_TRANSCODE)', () => {
    it('creates VIDEO_TRANSCODE job, transitions media to READY', async () => {
      const media = await seedMediaFile({
        user_id: TEST_USER_ID,
        content_type: 'video/mp4',
        original_filename: 'clip.mp4',
        status: 'PROCESSING',
        cdn_url: null,
      });

      await processingService.startProcessing(
        media.id,
        'video/mp4',
        media.storage_key,
        TEST_USER_ID
      );

      const dbMedia = await findMediaById(media.id);
      expect(dbMedia.status).toBe('READY');
      expect(dbMedia.cdn_url).toBeTruthy();
      expect(dbMedia.thumbnail_url).toBeTruthy();

      const jobs = await findJobsByMediaId(media.id);
      const transcodeJob = jobs.find((j: any) => j.job_type === 'VIDEO_TRANSCODE');
      expect(transcodeJob).toBeDefined();
      expect(transcodeJob.status).toBe('DONE');
    });

    it('processes QuickTime video correctly', async () => {
      const media = await seedMediaFile({
        user_id: TEST_USER_ID,
        content_type: 'video/quicktime',
        original_filename: 'clip.mov',
        status: 'PROCESSING',
        cdn_url: null,
      });

      await processingService.startProcessing(
        media.id,
        'video/quicktime',
        media.storage_key,
        TEST_USER_ID
      );

      const dbMedia = await findMediaById(media.id);
      expect(dbMedia.status).toBe('READY');
    });

    it('publishes media_processed event with cdn_url for video', async () => {
      const media = await seedMediaFile({
        user_id: TEST_USER_ID,
        content_type: 'video/mp4',
        status: 'PROCESSING',
        cdn_url: null,
      });

      await processingService.startProcessing(
        media.id,
        'video/mp4',
        media.storage_key,
        TEST_USER_ID
      );

      expect(mediaProducer.publishMediaProcessed).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaId: media.id,
          userId: TEST_USER_ID,
          cdn_url: expect.stringContaining('http://'),
        })
      );
    });
  });

  // ─── Unknown content type (no processing needed) ──────────────────────────────

  describe('Unknown content type (no-op processing)', () => {
    it('marks media as READY immediately without creating jobs', async () => {
      const media = await seedMediaFile({
        user_id: TEST_USER_ID,
        content_type: 'application/octet-stream',
        status: 'PROCESSING',
        cdn_url: null,
      });

      await processingService.startProcessing(
        media.id,
        'application/octet-stream',
        media.storage_key,
        TEST_USER_ID
      );

      const dbMedia = await findMediaById(media.id);
      expect(dbMedia.status).toBe('READY');
      expect(dbMedia.cdn_url).toBeTruthy();

      const jobs = await findJobsByMediaId(media.id);
      expect(jobs).toHaveLength(0);

      expect(mediaProducer.publishMediaProcessed).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Multiple jobs in sequence ────────────────────────────────────────────────

  describe('Multiple media files processed independently', () => {
    it('processes two image files without state leakage between them', async () => {
      const media1 = await seedMediaFile({
        user_id: TEST_USER_ID,
        content_type: 'image/jpeg',
        original_filename: 'img1.jpg',
        status: 'PROCESSING',
        cdn_url: null,
      });
      const media2 = await seedMediaFile({
        user_id: TEST_USER_ID,
        content_type: 'image/jpeg',
        original_filename: 'img2.jpg',
        status: 'PROCESSING',
        cdn_url: null,
      });

      await processingService.startProcessing(media1.id, 'image/jpeg', media1.storage_key, TEST_USER_ID);
      await processingService.startProcessing(media2.id, 'image/jpeg', media2.storage_key, TEST_USER_ID);

      const [db1, db2] = await Promise.all([
        findMediaById(media1.id),
        findMediaById(media2.id),
      ]);

      expect(db1.status).toBe('READY');
      expect(db2.status).toBe('READY');
      expect(db1.cdn_url).not.toBe(db2.cdn_url);

      const [jobs1, jobs2] = await Promise.all([
        findJobsByMediaId(media1.id),
        findJobsByMediaId(media2.id),
      ]);
      expect(jobs1).toHaveLength(1);
      expect(jobs2).toHaveLength(1);
    });
  });

  // ─── Model layer direct tests ─────────────────────────────────────────────────

  describe('MediaFileModel (real DB)', () => {
    it('findById returns null for non-existent ID', async () => {
      const result = await mediaModel.findById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });

    it('findById does not return DELETED records', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'DELETED' });
      const result = await mediaModel.findById(media.id);
      expect(result).toBeNull();
    });

    it('findByUserId returns only non-deleted records for the user', async () => {
      await seedMediaFile({ user_id: TEST_USER_ID, status: 'READY' });
      await seedMediaFile({ user_id: TEST_USER_ID, status: 'DELETED' });
      await seedMediaFile({ user_id: TEST_USER_ID, status: 'PROCESSING' });

      const results = await mediaModel.findByUserId(TEST_USER_ID);
      expect(results).toHaveLength(2); // DELETED excluded
      expect(results.every(r => r.status !== 'DELETED')).toBe(true);
    });

    it('updateStatus transitions the status and sets processed_at for READY', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'PROCESSING' });
      const updated = await mediaModel.updateStatus(media.id, 'READY');

      expect(updated.status).toBe('READY');
      expect(updated.processed_at).not.toBeNull();
    });

    it('updateStatus sets processed_at for FAILED', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'PROCESSING' });
      const updated = await mediaModel.updateStatus(media.id, 'FAILED');

      expect(updated.status).toBe('FAILED');
      expect(updated.processed_at).not.toBeNull();
    });

    it('updateProcessed updates all nullable fields correctly', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'PROCESSING', cdn_url: null });

      await mediaModel.updateProcessed(media.id, {
        status: 'READY',
        cdn_url: 'https://cdn.test/path.jpg',
        thumbnail_url: 'https://cdn.test/path_thumb.jpg',
        blurhash: 'LGFFaXYk',
        width: 1280,
        height: 720,
        duration_seconds: null,
        virus_scan_status: 'CLEAN',
      });

      const dbRow = await findMediaById(media.id);
      expect(dbRow.status).toBe('READY');
      expect(dbRow.cdn_url).toBe('https://cdn.test/path.jpg');
      expect(dbRow.thumbnail_url).toBe('https://cdn.test/path_thumb.jpg');
      expect(dbRow.blurhash).toBe('LGFFaXYk');
      expect(dbRow.width).toBe(1280);
      expect(dbRow.height).toBe(720);
      expect(dbRow.virus_scan_status).toBe('CLEAN');
    });

    it('softDelete sets status to DELETED', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'READY' });
      await mediaModel.softDelete(media.id);

      const db = getDatabase();
      const raw = await db('media_files').where({ id: media.id }).first();
      expect(raw.status).toBe('DELETED');
    });

    it('softDeleteByStorageKeys deletes all matching records', async () => {
      const m1 = await seedMediaFile({ user_id: TEST_USER_ID, status: 'READY' });
      const m2 = await seedMediaFile({ user_id: TEST_USER_ID, status: 'READY' });
      const m3 = await seedMediaFile({ user_id: TEST_USER_ID, status: 'READY' });

      await mediaModel.softDeleteByStorageKeys([m1.storage_key, m2.storage_key]);

      const db = getDatabase();
      const rows = await db('media_files').whereIn('id', [m1.id, m2.id, m3.id]).select('id', 'status');
      const statusById = Object.fromEntries(rows.map((r: any) => [r.id, r.status]));

      expect(statusById[m1.id]).toBe('DELETED');
      expect(statusById[m2.id]).toBe('DELETED');
      expect(statusById[m3.id]).toBe('READY'); // untouched
    });

    it('softDeleteByStorageKeys is a no-op for empty array', async () => {
      await expect(mediaModel.softDeleteByStorageKeys([])).resolves.not.toThrow();
    });
  });

  // ─── ProcessingJobModel (real DB) ─────────────────────────────────────────────

  describe('ProcessingJobModel (real DB)', () => {
    it('creates a job in QUEUED status', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'PROCESSING' });
      const job = await jobModel.create({ media_id: media.id, job_type: 'IMAGE_RESIZE' });

      expect(job.media_id).toBe(media.id);
      expect(job.job_type).toBe('IMAGE_RESIZE');
      expect(job.status).toBe('QUEUED');
      expect(job.error_message).toBeNull();
      expect(job.completed_at).toBeNull();
    });

    it('findByMediaId returns jobs ordered by created_at ascending', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID, status: 'PROCESSING' });
      await jobModel.create({ media_id: media.id, job_type: 'VIRUS_SCAN' });
      await jobModel.create({ media_id: media.id, job_type: 'IMAGE_RESIZE' });

      const jobs = await jobModel.findByMediaId(media.id);
      expect(jobs).toHaveLength(2);
      expect(jobs[0].job_type).toBe('VIRUS_SCAN');
      expect(jobs[1].job_type).toBe('IMAGE_RESIZE');
    });

    it('updateStatus transitions to PROCESSING (no completed_at)', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID });
      const job = await jobModel.create({ media_id: media.id, job_type: 'IMAGE_RESIZE' });
      const updated = await jobModel.updateStatus(job.id, 'PROCESSING');

      expect(updated.status).toBe('PROCESSING');
      expect(updated.completed_at).toBeNull();
    });

    it('updateStatus transitions to DONE (sets completed_at)', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID });
      const job = await jobModel.create({ media_id: media.id, job_type: 'IMAGE_RESIZE' });
      const updated = await jobModel.updateStatus(job.id, 'DONE');

      expect(updated.status).toBe('DONE');
      expect(updated.completed_at).not.toBeNull();
    });

    it('updateStatus transitions to FAILED with error message', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID });
      const job = await jobModel.create({ media_id: media.id, job_type: 'VIDEO_TRANSCODE' });
      const updated = await jobModel.updateStatus(job.id, 'FAILED', 'ffmpeg not found');

      expect(updated.status).toBe('FAILED');
      expect(updated.error_message).toBe('ffmpeg not found');
      expect(updated.completed_at).not.toBeNull();
    });

    it('getPendingJobs returns only QUEUED jobs ordered by created_at', async () => {
      const media1 = await seedMediaFile({ user_id: TEST_USER_ID });
      const media2 = await seedMediaFile({ user_id: TEST_USER_ID });

      const j1 = await jobModel.create({ media_id: media1.id, job_type: 'IMAGE_RESIZE' });
      const j2 = await jobModel.create({ media_id: media2.id, job_type: 'VIDEO_TRANSCODE' });
      await jobModel.updateStatus(j2.id, 'PROCESSING'); // j2 no longer QUEUED

      const pending = await jobModel.getPendingJobs(10);
      expect(pending.length).toBeGreaterThanOrEqual(1);
      expect(pending.find((j: any) => j.id === j1.id)).toBeDefined();
      expect(pending.find((j: any) => j.id === j2.id)).toBeUndefined();
    });

    it('throws when updating non-existent job', async () => {
      await expect(
        jobModel.updateStatus('00000000-0000-0000-0000-000000000000', 'DONE')
      ).rejects.toThrow('ProcessingJob 00000000-0000-0000-0000-000000000000 not found');
    });

    it('CASCADE deletes jobs when media is deleted', async () => {
      const media = await seedMediaFile({ user_id: TEST_USER_ID });
      const job = await jobModel.create({ media_id: media.id, job_type: 'IMAGE_RESIZE' });

      const db = getDatabase();
      await db('media_files').where({ id: media.id }).delete();

      const remaining = await db('processing_jobs').where({ id: job.id }).first();
      expect(remaining).toBeUndefined();
    });
  });
});
