/**
 * Unit tests — ProcessingService
 *
 * Mocks MediaFileModel, ProcessingJobModel, StorageService and MediaProducer.
 * Tests job orchestration logic, error paths, and DB state transitions.
 */

import { ProcessingService } from '../../src/services/processing.service';
import { MediaFileModel } from '../../src/models/media.model';
import { ProcessingJobModel } from '../../src/models/processingJob.model';
import { StorageService } from '../../src/services/storage.service';
import { MediaProducer } from '../../src/kafka/producers/media.producer';
import { createMediaFileFixture, createProcessingJobFixture } from '../fixtures';

jest.mock('../../src/models/media.model');
jest.mock('../../src/models/processingJob.model');
jest.mock('../../src/services/storage.service');
jest.mock('../../src/kafka/producers/media.producer');

const MockMediaModel = MediaFileModel as jest.MockedClass<typeof MediaFileModel>;
const MockJobModel = ProcessingJobModel as jest.MockedClass<typeof ProcessingJobModel>;
const MockStorageService = StorageService as jest.MockedClass<typeof StorageService>;
const MockMediaProducer = MediaProducer as jest.MockedClass<typeof MediaProducer>;

// We need to mock config so VIRUS_SCAN.ENABLED is controllable
jest.mock('../../src/config', () => ({
  config: {
    VIRUS_SCAN: { ENABLED: false },
    STORAGE: { CDN_BASE_URL: 'http://cdn.test' },
  },
}));

describe('ProcessingService', () => {
  let service: ProcessingService;
  let mediaModel: jest.Mocked<MediaFileModel>;
  let jobModel: jest.Mocked<ProcessingJobModel>;
  let storageService: jest.Mocked<StorageService>;
  let mediaProducer: jest.Mocked<MediaProducer>;

  const MEDIA_ID = 'media-test-id';
  const USER_ID = 'user-test-id';
  const STORAGE_KEY = 'user/media/file.jpg';

  beforeEach(() => {
    jest.clearAllMocks();

    mediaModel = new MockMediaModel() as jest.Mocked<MediaFileModel>;
    jobModel = new MockJobModel() as jest.Mocked<ProcessingJobModel>;
    storageService = new MockStorageService() as jest.Mocked<StorageService>;
    mediaProducer = new MockMediaProducer() as jest.Mocked<MediaProducer>;

    // Default happy-path mocks
    storageService.buildCdnUrl.mockImplementation(key => `http://cdn.test/${key}`);
    mediaModel.updateProcessed.mockResolvedValue(createMediaFileFixture({ status: 'READY' }));
    mediaModel.updateStatus.mockResolvedValue(createMediaFileFixture({ status: 'FAILED' }));
    mediaProducer.publishMediaProcessed.mockResolvedValue(undefined);
    jobModel.create.mockResolvedValue(createProcessingJobFixture({ status: 'QUEUED' }));
    jobModel.updateStatus.mockResolvedValue(createProcessingJobFixture({ status: 'DONE' }));
    jobModel.findByMediaId.mockResolvedValue([]);

    service = new ProcessingService(mediaModel, jobModel, storageService, mediaProducer);
  });

  // ─── Unknown content type (no jobs) ─────────────────────────────────────────

  describe('No-op path (unknown content type)', () => {
    it('marks media as READY without creating any jobs', async () => {
      await service.startProcessing(MEDIA_ID, 'application/octet-stream', STORAGE_KEY, USER_ID);

      expect(jobModel.create).not.toHaveBeenCalled();
      expect(mediaModel.updateProcessed).toHaveBeenCalledWith(
        MEDIA_ID,
        expect.objectContaining({ status: 'READY', cdn_url: expect.any(String) }),
      );
    });

    it('publishes media_processed event on no-op path', async () => {
      await service.startProcessing(MEDIA_ID, 'application/octet-stream', STORAGE_KEY, USER_ID);

      expect(mediaProducer.publishMediaProcessed).toHaveBeenCalledWith(
        expect.objectContaining({ mediaId: MEDIA_ID, userId: USER_ID }),
      );
    });

    it('continues gracefully if event publish fails on no-op path', async () => {
      mediaProducer.publishMediaProcessed.mockRejectedValue(new Error('Kafka down'));

      await expect(
        service.startProcessing(MEDIA_ID, 'application/octet-stream', STORAGE_KEY, USER_ID),
      ).resolves.not.toThrow();
    });
  });

  // ─── Image processing path ───────────────────────────────────────────────────

  describe('Image processing (IMAGE_RESIZE)', () => {
    const imageJob = createProcessingJobFixture({ job_type: 'IMAGE_RESIZE', status: 'QUEUED' });

    beforeEach(() => {
      jobModel.findByMediaId.mockResolvedValue([imageJob]);
      jobModel.updateStatus.mockResolvedValue(createProcessingJobFixture({ status: 'DONE' }));
    });

    it('creates IMAGE_RESIZE job for image/jpeg', async () => {
      await service.startProcessing(MEDIA_ID, 'image/jpeg', STORAGE_KEY, USER_ID);

      expect(jobModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ media_id: MEDIA_ID, job_type: 'IMAGE_RESIZE' }),
      );
    });

    it('creates IMAGE_RESIZE job for image/png', async () => {
      await service.startProcessing(MEDIA_ID, 'image/png', STORAGE_KEY, USER_ID);
      expect(jobModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ job_type: 'IMAGE_RESIZE' }),
      );
    });

    it('creates IMAGE_RESIZE job for image/gif', async () => {
      await service.startProcessing(MEDIA_ID, 'image/gif', STORAGE_KEY, USER_ID);
      expect(jobModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ job_type: 'IMAGE_RESIZE' }),
      );
    });

    it('marks media READY with cdn_url and thumbnail_url after image processing', async () => {
      await service.startProcessing(MEDIA_ID, 'image/jpeg', STORAGE_KEY, USER_ID);

      expect(mediaModel.updateProcessed).toHaveBeenCalledWith(
        MEDIA_ID,
        expect.objectContaining({
          status: 'READY',
          cdn_url: expect.stringContaining('cdn.test'),
          thumbnail_url: expect.stringContaining('_thumb'),
        }),
      );
    });

    it('publishes media_processed event with cdn_url', async () => {
      await service.startProcessing(MEDIA_ID, 'image/jpeg', STORAGE_KEY, USER_ID);

      expect(mediaProducer.publishMediaProcessed).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaId: MEDIA_ID,
          cdn_url: expect.stringContaining('cdn.test'),
        }),
      );
    });

    it('marks media FAILED if job creation throws', async () => {
      jobModel.create.mockRejectedValue(new Error('DB write error'));

      await service.startProcessing(MEDIA_ID, 'image/jpeg', STORAGE_KEY, USER_ID);

      expect(mediaModel.updateStatus).toHaveBeenCalledWith(MEDIA_ID, 'FAILED');
      expect(mediaModel.updateProcessed).not.toHaveBeenCalled();
    });

    it('marks media FAILED if image processing throws', async () => {
      // Make updateStatus on the job throw (simulates a broken DB mid-processing)
      jobModel.updateStatus
        .mockResolvedValueOnce(createProcessingJobFixture({ status: 'PROCESSING' })) // PROCESSING transition OK
        .mockRejectedValueOnce(new Error('DB error on DONE transition')); // DONE transition fails

      await service.startProcessing(MEDIA_ID, 'image/jpeg', STORAGE_KEY, USER_ID);

      expect(mediaModel.updateStatus).toHaveBeenCalledWith(MEDIA_ID, 'FAILED');
    });

    it('does not throw even if Kafka event fails', async () => {
      mediaProducer.publishMediaProcessed.mockRejectedValue(new Error('Kafka down'));

      await expect(
        service.startProcessing(MEDIA_ID, 'image/jpeg', STORAGE_KEY, USER_ID),
      ).resolves.not.toThrow();
    });
  });

  // ─── Video processing path ───────────────────────────────────────────────────

  describe('Video processing (VIDEO_TRANSCODE)', () => {
    const videoJob = createProcessingJobFixture({ job_type: 'VIDEO_TRANSCODE', status: 'QUEUED' });

    beforeEach(() => {
      jobModel.findByMediaId.mockResolvedValue([videoJob]);
    });

    it('creates VIDEO_TRANSCODE job for video/mp4', async () => {
      await service.startProcessing(MEDIA_ID, 'video/mp4', STORAGE_KEY, USER_ID);
      expect(jobModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ job_type: 'VIDEO_TRANSCODE' }),
      );
    });

    it('creates VIDEO_TRANSCODE job for video/quicktime', async () => {
      await service.startProcessing(MEDIA_ID, 'video/quicktime', STORAGE_KEY, USER_ID);
      expect(jobModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ job_type: 'VIDEO_TRANSCODE' }),
      );
    });

    it('marks media READY with cdn_url and thumbnail_url after video processing', async () => {
      await service.startProcessing(MEDIA_ID, 'video/mp4', STORAGE_KEY, USER_ID);

      expect(mediaModel.updateProcessed).toHaveBeenCalledWith(
        MEDIA_ID,
        expect.objectContaining({
          status: 'READY',
          cdn_url: expect.any(String),
          thumbnail_url: expect.stringContaining('_thumb.jpg'),
          duration_seconds: null,
        }),
      );
    });

    it('marks media FAILED if video processing throws', async () => {
      jobModel.updateStatus.mockRejectedValue(new Error('DB write error'));

      await service.startProcessing(MEDIA_ID, 'video/mp4', STORAGE_KEY, USER_ID);

      expect(mediaModel.updateStatus).toHaveBeenCalledWith(MEDIA_ID, 'FAILED');
    });
  });

  // ─── FAILED media status ─────────────────────────────────────────────────────

  describe('FAILED status handling', () => {
    it('does not throw even if marking FAILED itself fails', async () => {
      jobModel.create.mockRejectedValue(new Error('DB error'));
      mediaModel.updateStatus.mockRejectedValue(new Error('Cannot even mark FAILED'));

      await expect(
        service.startProcessing(MEDIA_ID, 'image/jpeg', STORAGE_KEY, USER_ID),
      ).resolves.not.toThrow();
    });
  });
});
