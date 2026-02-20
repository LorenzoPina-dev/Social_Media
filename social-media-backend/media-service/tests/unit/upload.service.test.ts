/**
 * Unit tests — UploadService
 *
 * All dependencies (MediaFileModel, StorageService, ProcessingService, MediaProducer)
 * are mocked. The database is never touched. Tests verify service-layer logic only.
 */

import { UploadService } from '../../src/services/upload.service';
import { MediaFileModel } from '../../src/models/media.model';
import { StorageService } from '../../src/services/storage.service';
import { ProcessingService } from '../../src/services/processing.service';
import { MediaProducer } from '../../src/kafka/producers/media.producer';
import { createMediaFileFixture } from '../fixtures';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  InternalError,
} from '../../src/types';

// ─── Mock all dependencies ─────────────────────────────────────────────────────
jest.mock('../../src/models/media.model');
jest.mock('../../src/services/storage.service');
jest.mock('../../src/services/processing.service');
jest.mock('../../src/kafka/producers/media.producer');

// The service no longer calls getDatabase() directly — no need to mock it here

const MockMediaModel = MediaFileModel as jest.MockedClass<typeof MediaFileModel>;
const MockStorageService = StorageService as jest.MockedClass<typeof StorageService>;
const MockProcessingService = ProcessingService as jest.MockedClass<typeof ProcessingService>;
const MockMediaProducer = MediaProducer as jest.MockedClass<typeof MediaProducer>;

describe('UploadService', () => {
  let service: UploadService;
  let mediaModel: jest.Mocked<MediaFileModel>;
  let storageService: jest.Mocked<StorageService>;
  let processingService: jest.Mocked<ProcessingService>;
  let mediaProducer: jest.Mocked<MediaProducer>;

  beforeEach(() => {
    jest.clearAllMocks();
    mediaModel = new MockMediaModel() as jest.Mocked<MediaFileModel>;
    storageService = new MockStorageService() as jest.Mocked<StorageService>;
    processingService = new MockProcessingService(
      null as any,
      null as any,
      null as any,
      null as any,
    ) as jest.Mocked<ProcessingService>;
    mediaProducer = new MockMediaProducer() as jest.Mocked<MediaProducer>;
    service = new UploadService(mediaModel, storageService, processingService, mediaProducer);
  });

  // ─── requestPresignedUpload ────────────────────────────────────────────────

  describe('requestPresignedUpload', () => {
    it('throws ValidationError for unsupported content type', async () => {
      await expect(
        service.requestPresignedUpload('user-1', {
          filename: 'test.pdf',
          content_type: 'application/pdf',
          size_bytes: 1000,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for text content type', async () => {
      await expect(
        service.requestPresignedUpload('user-1', {
          filename: 'readme.txt',
          content_type: 'text/plain',
          size_bytes: 500,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when size_bytes is 0', async () => {
      await expect(
        service.requestPresignedUpload('user-1', {
          filename: 'test.jpg',
          content_type: 'image/jpeg',
          size_bytes: 0,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when size_bytes is negative', async () => {
      await expect(
        service.requestPresignedUpload('user-1', {
          filename: 'test.jpg',
          content_type: 'image/jpeg',
          size_bytes: -1,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when file exceeds max size', async () => {
      await expect(
        service.requestPresignedUpload('user-1', {
          filename: 'big.jpg',
          content_type: 'image/jpeg',
          size_bytes: 999_999_999,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('throws InternalError when DB creation fails, not the raw DB error', async () => {
      mediaModel.create.mockRejectedValue(new Error('DB connection lost'));
      await expect(
        service.requestPresignedUpload('user-1', {
          filename: 'photo.jpg',
          content_type: 'image/jpeg',
          size_bytes: 1024,
        }),
      ).rejects.toThrow(InternalError);
    });

    it('throws InternalError when storage URL generation fails and rolls back DB', async () => {
      const created = createMediaFileFixture({ status: 'UPLOADING' });
      mediaModel.create.mockResolvedValue(created);
      mediaModel.softDelete.mockResolvedValue(undefined);
      storageService.generatePresignedPutUrl.mockRejectedValue(new Error('S3 unreachable'));

      await expect(
        service.requestPresignedUpload('user-1', {
          filename: 'photo.jpg',
          content_type: 'image/jpeg',
          size_bytes: 1024,
        }),
      ).rejects.toThrow(InternalError);

      // Must attempt to rollback the orphan DB record
      expect(mediaModel.softDelete).toHaveBeenCalledWith(created.id);
    });

    it('creates DB record via model.create() and returns presigned URL for image', async () => {
      const created = createMediaFileFixture({ status: 'UPLOADING' });
      mediaModel.create.mockResolvedValue(created);
      storageService.generatePresignedPutUrl.mockResolvedValue('https://storage.example.com/presigned');

      const result = await service.requestPresignedUpload('user-1', {
        filename: 'photo.jpg',
        content_type: 'image/jpeg',
        size_bytes: 1024 * 50,
      });

      expect(mediaModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          original_filename: 'photo.jpg',
          content_type: 'image/jpeg',
          size_bytes: 1024 * 50,
          status: 'UPLOADING',
          virus_scan_status: 'PENDING',
        }),
      );
      expect(result).toMatchObject({
        upload_url: 'https://storage.example.com/presigned',
        media_id: expect.any(String),
        expires_in: expect.any(Number),
        storage_key: expect.stringContaining('user-1'),
      });
    });

    it('accepts video/mp4 content type', async () => {
      mediaModel.create.mockResolvedValue(createMediaFileFixture({ content_type: 'video/mp4' }));
      storageService.generatePresignedPutUrl.mockResolvedValue('https://storage.example.com/video');

      const result = await service.requestPresignedUpload('user-1', {
        filename: 'video.mp4',
        content_type: 'video/mp4',
        size_bytes: 1024 * 1024 * 10,
      });

      expect(result.upload_url).toBe('https://storage.example.com/video');
    });

    it('accepts image/webp content type', async () => {
      mediaModel.create.mockResolvedValue(createMediaFileFixture({ content_type: 'image/webp' }));
      storageService.generatePresignedPutUrl.mockResolvedValue('https://storage.example.com/webp');

      await expect(
        service.requestPresignedUpload('user-1', {
          filename: 'photo.webp',
          content_type: 'image/webp',
          size_bytes: 1024,
        }),
      ).resolves.toMatchObject({ upload_url: expect.any(String) });
    });

    it('sanitizes dangerous characters in filename before building storage key', async () => {
      mediaModel.create.mockResolvedValue(createMediaFileFixture());
      storageService.generatePresignedPutUrl.mockResolvedValue('https://storage.example.com/url');

      await service.requestPresignedUpload('user-1', {
        filename: '../../../etc/passwd.jpg',
        content_type: 'image/jpeg',
        size_bytes: 1000,
      });

      const createCall = mediaModel.create.mock.calls[0][0];
      expect(createCall.storage_key).not.toContain('../');
    });
  });

  // ─── confirmUpload ─────────────────────────────────────────────────────────

  describe('confirmUpload', () => {
    it('throws NotFoundError if media does not exist', async () => {
      mediaModel.findById.mockResolvedValue(null);

      await expect(
        service.confirmUpload('media-1', 'user-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError if user does not own the media', async () => {
      mediaModel.findById.mockResolvedValue(
        createMediaFileFixture({ user_id: 'other-user', status: 'UPLOADING' }),
      );

      await expect(
        service.confirmUpload('media-1', 'user-1'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ValidationError if media is in READY status', async () => {
      mediaModel.findById.mockResolvedValue(
        createMediaFileFixture({ user_id: 'user-1', status: 'READY' }),
      );

      await expect(
        service.confirmUpload('media-1', 'user-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError if media is in FAILED status', async () => {
      mediaModel.findById.mockResolvedValue(
        createMediaFileFixture({ user_id: 'user-1', status: 'FAILED' }),
      );

      await expect(
        service.confirmUpload('media-1', 'user-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError if media is in PROCESSING status', async () => {
      mediaModel.findById.mockResolvedValue(
        createMediaFileFixture({ user_id: 'user-1', status: 'PROCESSING' }),
      );

      await expect(
        service.confirmUpload('media-1', 'user-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError if object not found in storage', async () => {
      mediaModel.findById.mockResolvedValue(
        createMediaFileFixture({ user_id: 'user-1', status: 'UPLOADING' }),
      );
      storageService.objectExists.mockResolvedValue(false);

      await expect(
        service.confirmUpload('media-1', 'user-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws InternalError if DB read fails', async () => {
      mediaModel.findById.mockRejectedValue(new Error('DB error'));

      await expect(
        service.confirmUpload('media-1', 'user-1'),
      ).rejects.toThrow(InternalError);
    });

    it('throws InternalError if storage check fails', async () => {
      mediaModel.findById.mockResolvedValue(
        createMediaFileFixture({ user_id: 'user-1', status: 'UPLOADING' }),
      );
      storageService.objectExists.mockRejectedValue(new Error('Storage unavailable'));

      await expect(
        service.confirmUpload('media-1', 'user-1'),
      ).rejects.toThrow(InternalError);
    });

    it('throws InternalError if updateStatus fails', async () => {
      mediaModel.findById.mockResolvedValue(
        createMediaFileFixture({ user_id: 'user-1', status: 'UPLOADING' }),
      );
      storageService.objectExists.mockResolvedValue(true);
      mediaModel.updateStatus.mockRejectedValue(new Error('DB write failed'));

      await expect(
        service.confirmUpload('media-1', 'user-1'),
      ).rejects.toThrow(InternalError);
    });

    it('transitions to PROCESSING, fires background processing, returns updated media', async () => {
      const media = createMediaFileFixture({ user_id: 'user-1', status: 'UPLOADING' });
      const processing = createMediaFileFixture({ user_id: 'user-1', status: 'PROCESSING' });
      mediaModel.findById.mockResolvedValue(media);
      storageService.objectExists.mockResolvedValue(true);
      mediaModel.updateStatus.mockResolvedValue(processing);
      mediaProducer.publishMediaUploaded.mockResolvedValue(undefined);
      processingService.startProcessing.mockResolvedValue(undefined);

      const result = await service.confirmUpload(media.id, 'user-1');

      expect(mediaModel.updateStatus).toHaveBeenCalledWith(media.id, 'PROCESSING');
      expect(mediaProducer.publishMediaUploaded).toHaveBeenCalledWith(
        expect.objectContaining({ mediaId: media.id, userId: 'user-1' }),
      );
      expect(result.status).toBe('PROCESSING');
    });

    it('succeeds even if Kafka publish fails (best-effort)', async () => {
      const media = createMediaFileFixture({ user_id: 'user-1', status: 'UPLOADING' });
      const processing = createMediaFileFixture({ user_id: 'user-1', status: 'PROCESSING' });
      mediaModel.findById.mockResolvedValue(media);
      storageService.objectExists.mockResolvedValue(true);
      mediaModel.updateStatus.mockResolvedValue(processing);
      mediaProducer.publishMediaUploaded.mockRejectedValue(new Error('Kafka down'));
      processingService.startProcessing.mockResolvedValue(undefined);

      // Should not throw despite Kafka failure
      await expect(service.confirmUpload(media.id, 'user-1')).resolves.toMatchObject({
        status: 'PROCESSING',
      });
    });
  });

  // ─── deleteMedia ──────────────────────────────────────────────────────────

  describe('deleteMedia', () => {
    it('throws NotFoundError if media does not exist', async () => {
      mediaModel.findById.mockResolvedValue(null);

      await expect(service.deleteMedia('media-1', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError if user does not own the media', async () => {
      mediaModel.findById.mockResolvedValue(
        createMediaFileFixture({ user_id: 'other-user' }),
      );

      await expect(service.deleteMedia('media-1', 'user-1')).rejects.toThrow(ForbiddenError);
    });

    it('throws InternalError if DB read fails', async () => {
      mediaModel.findById.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteMedia('media-1', 'user-1')).rejects.toThrow(InternalError);
    });

    it('throws InternalError if softDelete fails', async () => {
      mediaModel.findById.mockResolvedValue(
        createMediaFileFixture({ user_id: 'user-1' }),
      );
      mediaModel.softDelete.mockRejectedValue(new Error('DB write error'));

      await expect(service.deleteMedia('media-1', 'user-1')).rejects.toThrow(InternalError);
    });

    it('soft-deletes and publishes event on success', async () => {
      const media = createMediaFileFixture({ user_id: 'user-1' });
      mediaModel.findById.mockResolvedValue(media);
      mediaModel.softDelete.mockResolvedValue(undefined);
      storageService.deleteObject.mockResolvedValue(undefined);
      mediaProducer.publishMediaDeleted.mockResolvedValue(undefined);

      await service.deleteMedia(media.id, 'user-1');

      expect(mediaModel.softDelete).toHaveBeenCalledWith(media.id);
      expect(storageService.deleteObject).toHaveBeenCalledWith(media.storage_key);
      expect(mediaProducer.publishMediaDeleted).toHaveBeenCalledWith(
        expect.objectContaining({ mediaId: media.id, userId: 'user-1' }),
      );
    });

    it('succeeds even if storage deletion fails (best-effort)', async () => {
      const media = createMediaFileFixture({ user_id: 'user-1' });
      mediaModel.findById.mockResolvedValue(media);
      mediaModel.softDelete.mockResolvedValue(undefined);
      storageService.deleteObject.mockRejectedValue(new Error('S3 timeout'));
      mediaProducer.publishMediaDeleted.mockResolvedValue(undefined);

      await expect(service.deleteMedia(media.id, 'user-1')).resolves.not.toThrow();
      expect(mediaModel.softDelete).toHaveBeenCalledWith(media.id);
    });

    it('succeeds even if Kafka publish fails (best-effort)', async () => {
      const media = createMediaFileFixture({ user_id: 'user-1' });
      mediaModel.findById.mockResolvedValue(media);
      mediaModel.softDelete.mockResolvedValue(undefined);
      storageService.deleteObject.mockResolvedValue(undefined);
      mediaProducer.publishMediaDeleted.mockRejectedValue(new Error('Kafka down'));

      await expect(service.deleteMedia(media.id, 'user-1')).resolves.not.toThrow();
    });
  });

  // ─── getMediaStatus ────────────────────────────────────────────────────────

  describe('getMediaStatus', () => {
    it('throws NotFoundError if media does not exist', async () => {
      mediaModel.findById.mockResolvedValue(null);

      await expect(service.getMediaStatus('media-1', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError if user does not own the media', async () => {
      mediaModel.findById.mockResolvedValue(
        createMediaFileFixture({ user_id: 'other-user' }),
      );

      await expect(service.getMediaStatus('media-1', 'user-1')).rejects.toThrow(ForbiddenError);
    });

    it('throws InternalError if DB read fails', async () => {
      mediaModel.findById.mockRejectedValue(new Error('DB error'));

      await expect(service.getMediaStatus('media-1', 'user-1')).rejects.toThrow(InternalError);
    });

    it('returns the media file if user owns it', async () => {
      const media = createMediaFileFixture({ user_id: 'user-1', status: 'READY' });
      mediaModel.findById.mockResolvedValue(media);

      const result = await service.getMediaStatus(media.id, 'user-1');
      expect(result.id).toBe(media.id);
      expect(result.status).toBe('READY');
    });
  });

  // ─── listUserMedia ─────────────────────────────────────────────────────────

  describe('listUserMedia', () => {
    it('returns paginated list from model', async () => {
      const files = [
        createMediaFileFixture({ user_id: 'user-1' }),
        createMediaFileFixture({ user_id: 'user-1' }),
      ];
      mediaModel.findByUserId.mockResolvedValue(files);

      const result = await service.listUserMedia('user-1', 10, 0);

      expect(mediaModel.findByUserId).toHaveBeenCalledWith('user-1', 10, 0);
      expect(result).toHaveLength(2);
    });

    it('throws InternalError if DB query fails', async () => {
      mediaModel.findByUserId.mockRejectedValue(new Error('DB error'));

      await expect(service.listUserMedia('user-1')).rejects.toThrow(InternalError);
    });

    it('returns empty array when user has no media', async () => {
      mediaModel.findByUserId.mockResolvedValue([]);

      const result = await service.listUserMedia('user-1');
      expect(result).toEqual([]);
    });
  });
});
