/**
 * Upload Service — media-service
 *
 * Handles the presigned-URL upload flow:
 *  1. Client calls POST /upload/presigned  → receive upload_url + media_id
 *  2. Client uploads directly to S3/MinIO  (bypasses this service)
 *  3. Client calls POST /upload/confirm/:mediaId → trigger processing
 *
 * Exception handling strategy
 * ───────────────────────────
 * • Domain errors (validation, auth, not-found) are thrown as typed AppError
 *   subclasses so the global errorHandler can map them to the correct HTTP status.
 * • Infrastructure errors (DB, storage, Kafka) are caught, logged, and re-thrown
 *   wrapped in InternalError so callers always receive a typed error.
 */

import { v4 as uuidv4 } from 'uuid';
import { MediaFileModel } from '../models/media.model';
import { StorageService } from './storage.service';
import { ProcessingService } from './processing.service';
import { MediaProducer } from '../kafka/producers/media.producer';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  InternalError,
} from '../types';
import type { MediaFile, PresignedUploadRequestDto, PresignedUploadResponse } from '../types';

export class UploadService {
  constructor(
    private readonly mediaModel: MediaFileModel,
    private readonly storageService: StorageService,
    private readonly processingService: ProcessingService,
    private readonly mediaProducer: MediaProducer,
  ) {}

  // ─── Presigned upload request ────────────────────────────────────────────────

  /**
   * Validate content-type and size, create the DB record, return presigned URL.
   */
  async requestPresignedUpload(
    userId: string,
    dto: PresignedUploadRequestDto,
  ): Promise<PresignedUploadResponse> {
    // ── Validate content-type ──────────────────────────────────────────────────
    const allowed = [
      ...config.UPLOAD.ALLOWED_IMAGE_TYPES,
      ...config.UPLOAD.ALLOWED_VIDEO_TYPES,
    ];
    if (!allowed.includes(dto.content_type)) {
      throw new ValidationError(
        `Unsupported content type: ${dto.content_type}. Allowed: ${allowed.join(', ')}`,
      );
    }

    // ── Validate size ──────────────────────────────────────────────────────────
    if (dto.size_bytes <= 0) {
      throw new ValidationError('size_bytes must be greater than 0');
    }
    if (dto.size_bytes > config.UPLOAD.MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(
        `File too large. Max allowed: ${config.UPLOAD.MAX_FILE_SIZE_BYTES} bytes`,
      );
    }

    // ── Build storage key ──────────────────────────────────────────────────────
    const mediaId = uuidv4();
    const safeFilename = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `${userId}/${mediaId}/${safeFilename}`;

    // ── Persist DB record via model (keeps unit-testability) ───────────────────
    try {
      await this.mediaModel.create({
        id: mediaId,
        user_id: userId,
        original_filename: dto.filename,
        content_type: dto.content_type,
        size_bytes: dto.size_bytes,
        storage_key: storageKey,
        status: 'UPLOADING',
        virus_scan_status: 'PENDING',
      });
    } catch (err: unknown) {
      logger.error('Failed to create media file record', { error: err, userId, mediaId });
      throw new InternalError('Failed to initiate upload. Please try again.');
    }

    // ── Generate presigned PUT URL ─────────────────────────────────────────────
    let upload_url: string;
    try {
      upload_url = await this.storageService.generatePresignedPutUrl(
        storageKey,
        dto.content_type,
        dto.size_bytes,
      );
    } catch (err: unknown) {
      // Storage failure after DB insert — clean up orphan record
      logger.error('Failed to generate presigned URL — rolling back DB record', {
        error: err,
        mediaId,
      });
      try {
        await this.mediaModel.softDelete(mediaId);
      } catch (rollbackErr: unknown) {
        logger.error('Failed to rollback orphan media record', {
          error: rollbackErr,
          mediaId,
        });
      }
      throw new InternalError('Failed to generate upload URL. Please try again.');
    }

    logger.info('Presigned upload URL generated', { userId, mediaId, storageKey });

    return {
      media_id: mediaId,
      upload_url,
      // BUGFIX: was hardcoded to old field; now reflects actual expiry from config
      expires_in: config.STORAGE.PRESIGNED_URL_EXPIRY,
      expires_at: new Date(Date.now() + config.STORAGE.PRESIGNED_URL_EXPIRY * 1000).toISOString(),
      storage_key: storageKey,
    };
  }

  // ─── Confirm upload ──────────────────────────────────────────────────────────

  /**
   * Confirm that the file was uploaded.
   * Transitions status UPLOADING → PROCESSING and enqueues processing jobs.
   */
  async confirmUpload(mediaId: string, userId: string): Promise<MediaFile> {
    // ── Fetch & authorise ──────────────────────────────────────────────────────
    let media: MediaFile | null;
    try {
      media = await this.mediaModel.findById(mediaId);
    } catch (err: unknown) {
      logger.error('DB error fetching media for confirm', { error: err, mediaId });
      throw new InternalError('Failed to retrieve media record.');
    }

    if (!media) throw new NotFoundError(`Media ${mediaId} not found`);
    if (media.user_id !== userId) throw new ForbiddenError('You do not own this media');
    if (media.status !== 'UPLOADING') {
      throw new ValidationError(
        `Cannot confirm upload: media is in status "${media.status}"`,
      );
    }

    // ── Verify object exists in storage ────────────────────────────────────────
    let exists: boolean;
    try {
      exists = await this.storageService.objectExists(media.storage_key);
    } catch (err: unknown) {
      logger.error('Storage check failed during confirm', { error: err, mediaId });
      throw new InternalError('Failed to verify file in storage. Please retry.');
    }

    if (!exists) {
      throw new ValidationError(
        'File not found in storage. The upload may not have completed successfully.',
      );
    }

    // ── Transition UPLOADING → PROCESSING ─────────────────────────────────────
    let updated: MediaFile;
    try {
      updated = await this.mediaModel.updateStatus(mediaId, 'PROCESSING');
    } catch (err: unknown) {
      logger.error('DB error transitioning media to PROCESSING', { error: err, mediaId });
      throw new InternalError('Failed to update media status.');
    }

    // ── Publish Kafka event (best-effort) ──────────────────────────────────────
    try {
      await this.mediaProducer.publishMediaUploaded({
        mediaId,
        userId,
        content_type: media.content_type,
        size_bytes: media.size_bytes,
        storage_key: media.storage_key,
      });
    } catch (err: unknown) {
      // Non-fatal: processing still continues without the event
      logger.error('Failed to publish media_uploaded event', { error: err, mediaId });
    }

    // ── Kick off async processing (non-blocking) ───────────────────────────────
    this.processingService
      .startProcessing(mediaId, media.content_type, media.storage_key, userId)
      .catch((err: unknown) =>
        logger.error('Background processing failed', { error: err, mediaId }),
      );

    return updated;
  }

  // ─── Get status ──────────────────────────────────────────────────────────────

  async getMediaStatus(mediaId: string, userId: string): Promise<MediaFile> {
    let media: MediaFile | null;
    try {
      media = await this.mediaModel.findById(mediaId);
    } catch (err: unknown) {
      logger.error('DB error fetching media status', { error: err, mediaId });
      throw new InternalError('Failed to retrieve media record.');
    }

    if (!media) throw new NotFoundError(`Media ${mediaId} not found`);
    if (media.user_id !== userId) throw new ForbiddenError('You do not own this media');

    return media;
  }

  // ─── Delete media ─────────────────────────────────────────────────────────────

  async deleteMedia(mediaId: string, userId: string): Promise<void> {
    let media: MediaFile | null;
    try {
      media = await this.mediaModel.findById(mediaId);
    } catch (err: unknown) {
      logger.error('DB error fetching media for deletion', { error: err, mediaId });
      throw new InternalError('Failed to retrieve media record.');
    }

    if (!media) throw new NotFoundError(`Media ${mediaId} not found`);
    if (media.user_id !== userId) throw new ForbiddenError('You do not own this media');

    // ── Soft-delete in DB ──────────────────────────────────────────────────────
    try {
      await this.mediaModel.softDelete(mediaId);
    } catch (err: unknown) {
      logger.error('DB error soft-deleting media', { error: err, mediaId });
      throw new InternalError('Failed to delete media record.');
    }

    // ── Delete from storage (best-effort) ─────────────────────────────────────
    try {
      await this.storageService.deleteObject(media.storage_key);
    } catch (err: unknown) {
      // DB is already updated — log but don't fail the request
      logger.error('Failed to delete object from storage (DB already soft-deleted)', {
        error: err,
        mediaId,
        storageKey: media.storage_key,
      });
    }

    // ── Publish deletion event (best-effort) ───────────────────────────────────
    try {
      await this.mediaProducer.publishMediaDeleted({ mediaId, userId });
    } catch (err: unknown) {
      logger.error('Failed to publish media_deleted event', { error: err, mediaId });
    }

    logger.info('Media deleted', { mediaId, userId });
  }

  // ─── List user media ──────────────────────────────────────────────────────────

  async listUserMedia(userId: string, limit = 20, offset = 0): Promise<MediaFile[]> {
    try {
      return await this.mediaModel.findByUserId(userId, limit, offset);
    } catch (err: unknown) {
      logger.error('DB error listing user media', { error: err, userId });
      throw new InternalError('Failed to retrieve media list.');
    }
  }
}
