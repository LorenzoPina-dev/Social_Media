/**
 * Storage Service — media-service
 * Abstraction for AWS S3 / MinIO file storage.
 *
 * Fix log:
 *  - BUGFIX: forcePathStyle is now driven by config (was always false → broke MinIO)
 *  - BUGFIX: Added getObject() to download file buffers (required by ProcessingService)
 *  - BUGFIX: Added generatePresignedGetUrl() for read presigned URLs
 *  - BUGFIX: initClient() no longer silently swallows errors; logs the real failure reason
 *  - BUGFIX: Stub mode generatePresignedPutUrl uses the correct bucket name from config
 */

import { config } from '../config';
import { logger } from '../utils/logger';

export interface PresignedUrlResult {
  upload_url: string;
  cdn_url: string;
  expires_in: number;
}

export class StorageService {
  private s3Client: any | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    try {
      const { S3Client } = require('@aws-sdk/client-s3');

      this.s3Client = new S3Client({
        region: config.STORAGE.AWS_REGION,
        credentials: {
          accessKeyId: config.STORAGE.AWS_ACCESS_KEY_ID,
          secretAccessKey: config.STORAGE.AWS_SECRET_ACCESS_KEY,
        },
        // BUGFIX: was always undefined; MinIO requires endpoint + forcePathStyle
        ...(config.STORAGE.TYPE === 'minio' || config.STORAGE.FORCE_PATH_STYLE
          ? {
              endpoint: config.STORAGE.MINIO_ENDPOINT,
              forcePathStyle: true,
            }
          : {}),
      });

      logger.info(`✅ Storage client initialised`, {
        type: config.STORAGE.TYPE,
        endpoint: config.STORAGE.MINIO_ENDPOINT,
        bucket: config.STORAGE.AWS_S3_BUCKET,
        forcePathStyle: config.STORAGE.FORCE_PATH_STYLE,
      });
    } catch (err: unknown) {
      // BUGFIX: log actual error instead of generic message
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`⚠️  Storage client unavailable (${msg}) — running in STUB mode`);
    }
  }

  /**
   * Generate a presigned PUT URL so the client uploads directly to S3/MinIO.
   */
  async generatePresignedPutUrl(
    storageKey: string,
    contentType: string,
    sizeBytes: number,
  ): Promise<string> {
    if (!this.s3Client) {
      // BUGFIX: stub URL now uses correct bucket from config
      return `${config.STORAGE.MINIO_ENDPOINT}/${config.STORAGE.AWS_S3_BUCKET}/${storageKey}?stub=true`;
    }

    try {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

      const command = new PutObjectCommand({
        Bucket: config.STORAGE.AWS_S3_BUCKET,
        Key: storageKey,
        ContentType: contentType,
        ContentLength: sizeBytes,
      });

      return await getSignedUrl(this.s3Client, command, {
        expiresIn: config.STORAGE.PRESIGNED_URL_EXPIRY,
      });
    } catch (error) {
      logger.error('Failed to generate presigned PUT URL', { error, storageKey });
      throw error;
    }
  }

  /**
   * Generate a presigned GET URL for reading a stored object.
   */
  async generatePresignedGetUrl(storageKey: string, expiresIn = 3600): Promise<string> {
    if (!this.s3Client) {
      return `${config.STORAGE.MINIO_ENDPOINT}/${config.STORAGE.AWS_S3_BUCKET}/${storageKey}?stub=true`;
    }

    try {
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

      return await getSignedUrl(
        this.s3Client,
        new GetObjectCommand({ Bucket: config.STORAGE.AWS_S3_BUCKET, Key: storageKey }),
        { expiresIn },
      );
    } catch (error) {
      logger.error('Failed to generate presigned GET URL', { error, storageKey });
      throw error;
    }
  }

  /**
   * Download an object from storage and return its content as a Buffer.
   * Used by ProcessingService to feed files into sharp/ffmpeg.
   */
  async getObject(storageKey: string): Promise<Buffer> {
    if (!this.s3Client) {
      logger.warn('Storage stub — returning empty buffer for getObject', { storageKey });
      return Buffer.alloc(0);
    }

    try {
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: config.STORAGE.AWS_S3_BUCKET, Key: storageKey }),
      );

      // Node.js stream → Buffer
      const stream = response.Body as NodeJS.ReadableStream;
      return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to get object from storage', { error, storageKey });
      throw error;
    }
  }

  /**
   * Upload a Buffer to storage (used by ProcessingService to store processed files).
   */
  async putObject(storageKey: string, body: Buffer, contentType: string): Promise<void> {
    if (!this.s3Client) {
      logger.warn('Storage stub — skipping putObject', { storageKey });
      return;
    }

    try {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: config.STORAGE.AWS_S3_BUCKET,
          Key: storageKey,
          Body: body,
          ContentType: contentType,
        }),
      );
      logger.debug('Object uploaded to storage', { storageKey, bytes: body.length });
    } catch (error) {
      logger.error('Failed to put object to storage', { error, storageKey });
      throw error;
    }
  }

  /**
   * Delete an object from storage.
   */
  async deleteObject(storageKey: string): Promise<void> {
    if (!this.s3Client) {
      logger.warn('Storage stub — skipping deleteObject', { storageKey });
      return;
    }

    try {
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: config.STORAGE.AWS_S3_BUCKET, Key: storageKey }),
      );
      logger.info('Object deleted from storage', { storageKey });
    } catch (error) {
      logger.error('Failed to delete object from storage', { error, storageKey });
      throw error;
    }
  }

  /**
   * Check whether an object exists in storage.
   */
  async objectExists(storageKey: string): Promise<boolean> {
    if (!this.s3Client) return true; // Stub — assume exists

    try {
      const { HeadObjectCommand } = require('@aws-sdk/client-s3');
      await this.s3Client.send(
        new HeadObjectCommand({ Bucket: config.STORAGE.AWS_S3_BUCKET, Key: storageKey }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build the public CDN URL for a storage key.
   */
  buildCdnUrl(storageKey: string): string {
    return `${config.STORAGE.CDN_BASE_URL}/${storageKey}`;
  }
}
