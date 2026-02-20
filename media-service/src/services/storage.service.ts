/**
 * Storage Service — media-service
 * Abstraction for AWS S3 / MinIO file storage
 * Generates presigned URLs for client-side direct upload
 */

import { config } from '../config';
import { logger } from '../utils/logger';

export interface PresignedUrlResult {
  upload_url: string;
  cdn_url: string;
  expires_in: number;
}

/**
 * StorageService provides an interface to S3 or MinIO.
 * It uses the AWS SDK (S3-compatible API — MinIO is S3-compatible).
 * If the SDK is not available at runtime, methods gracefully degrade
 * to stub mode (useful in test environments).
 */
export class StorageService {
  private s3Client: any | null = null;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    try {
      // Dynamic require — @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
      // are optional peer dependencies. In test environments they may be absent.
      const { S3Client } = require('@aws-sdk/client-s3');

      const isMinIO = config.STORAGE.TYPE === 'minio';

      this.s3Client = new S3Client({
        region: config.STORAGE.AWS_REGION,
        credentials: {
          accessKeyId: config.STORAGE.AWS_ACCESS_KEY_ID,
          secretAccessKey: config.STORAGE.AWS_SECRET_ACCESS_KEY,
        },
        ...(isMinIO && {
          endpoint: config.STORAGE.MINIO_ENDPOINT,
          forcePathStyle: true,
        }),
      });

      logger.info(`✅ Storage client initialised (${config.STORAGE.TYPE})`);
    } catch {
      logger.warn('AWS SDK not available — storage running in STUB mode');
    }
  }

  /**
   * Generate a presigned PUT URL so the client uploads directly to storage.
   */
  async generatePresignedPutUrl(
    storageKey: string,
    contentType: string,
    sizeBytes: number
  ): Promise<string> {
    if (!this.s3Client) {
      // Stub mode — return a fake URL for local development / tests
      return `http://localhost:9000/${config.STORAGE.AWS_S3_BUCKET}/${storageKey}?stub=true`;
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

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: config.STORAGE.PRESIGNED_URL_EXPIRY,
      });

      return url;
    } catch (error) {
      logger.error('Failed to generate presigned URL', { error, storageKey });
      throw error;
    }
  }

  /**
   * Delete an object from storage.
   */
  async deleteObject(storageKey: string): Promise<void> {
    if (!this.s3Client) {
      logger.warn('Storage stub — skipping object deletion', { storageKey });
      return;
    }

    try {
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: config.STORAGE.AWS_S3_BUCKET,
          Key: storageKey,
        })
      );
      logger.info('Object deleted from storage', { storageKey });
    } catch (error) {
      logger.error('Failed to delete object from storage', { error, storageKey });
      throw error;
    }
  }

  /**
   * Build the public CDN URL for a storage key.
   */
  buildCdnUrl(storageKey: string): string {
    return `${config.STORAGE.CDN_BASE_URL}/${storageKey}`;
  }

  /**
   * Check whether an object exists in storage.
   */
  async objectExists(storageKey: string): Promise<boolean> {
    if (!this.s3Client) return true; // Stub — assume it exists

    try {
      const { HeadObjectCommand } = require('@aws-sdk/client-s3');
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: config.STORAGE.AWS_S3_BUCKET,
          Key: storageKey,
        })
      );
      return true;
    } catch {
      return false;
    }
  }
}
