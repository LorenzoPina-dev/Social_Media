/**
 * Media Service Configuration
 *
 * Fix log:
 *  - BUGFIX: MINIO_ENDPOINT now also reads AWS_ENDPOINT (docker-compose uses AWS_ENDPOINT)
 *  - BUGFIX: AWS_S3_BUCKET now also reads AWS_BUCKET_NAME (docker-compose uses AWS_BUCKET_NAME)
 *  - BUGFIX: forcePathStyle driven by AWS_FORCE_PATH_STYLE env var
 *  - BUGFIX: validateEnv warns instead of crashing in development; only hard-throws in production
 *  - BUGFIX: Added PRESIGNED_URL_EXPIRY from env var
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function validateEnv(): void {
  const required = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'REDIS_URL', 'KAFKA_BROKERS', 'JWT_ACCESS_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    if (process.env.NODE_ENV === 'production') {
      // In production, crash immediately — misconfigured prod is unacceptable
      throw new Error(msg);
    } else {
      // In development, warn and continue — allows running partial infra locally
      console.warn(`⚠️  [config] ${msg} — continuing in dev mode`);
    }
  }
}

validateEnv();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3004', 10),
  SERVICE_NAME: 'media-service',
  VERSION: process.env.npm_package_version || '1.0.0',

  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || '2', 10),
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '10', 10),
  DB_IDLE_TIMEOUT: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  // FIX: increased default from 2000ms to 10000ms — cold Docker is slow
  DB_CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),

  REDIS_URL: process.env.REDIS_URL || '',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_TLS: process.env.REDIS_TLS === 'true',

  KAFKA_BROKERS: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'media-service',
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'media-service-group',

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || '',

  STORAGE: {
    // BUGFIX: accept both STORAGE_TYPE and AWS_FORCE_PATH_STYLE to detect minio
    TYPE: (process.env.STORAGE_TYPE || (process.env.AWS_FORCE_PATH_STYLE === 'true' ? 'minio' : 's3')) as 'minio' | 's3',
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
    // BUGFIX: docker-compose passes AWS_BUCKET_NAME, fallback to AWS_S3_BUCKET or default
    AWS_S3_BUCKET: process.env.AWS_BUCKET_NAME || process.env.AWS_S3_BUCKET || 'social-media-uploads',
    AWS_S3_BUCKET_THUMBNAILS: process.env.AWS_BUCKET_THUMBNAILS || process.env.AWS_S3_BUCKET_THUMBNAILS || 'media-thumbnails',
    // BUGFIX: docker-compose passes AWS_ENDPOINT, fallback to MINIO_ENDPOINT
    MINIO_ENDPOINT: process.env.AWS_ENDPOINT || process.env.MINIO_ENDPOINT || 'http://localhost:9000',
    FORCE_PATH_STYLE: process.env.AWS_FORCE_PATH_STYLE === 'true' || process.env.STORAGE_TYPE === 'minio',
    CDN_BASE_URL: process.env.CDN_BASE_URL || 'http://localhost:9000/social-media-uploads',
    // BUGFIX: make presigned URL expiry configurable; default 15min instead of 1h
    PRESIGNED_URL_EXPIRY: parseInt(process.env.PRESIGNED_URL_EXPIRY_SECONDS || '900', 10),
  },

  UPLOAD: {
    MAX_FILE_SIZE_BYTES: parseInt(process.env.MAX_FILE_SIZE_BYTES || '52428800', 10), // 50MB
    ALLOWED_IMAGE_TYPES: (process.env.ALLOWED_IMAGE_TYPES || 'image/jpeg,image/png,image/gif,image/webp').split(','),
    ALLOWED_VIDEO_TYPES: (process.env.ALLOWED_VIDEO_TYPES || 'video/mp4,video/quicktime,video/webm').split(','),
  },

  VIRUS_SCAN: {
    ENABLED: process.env.VIRUS_SCAN_ENABLED === 'true',
    CLAMAV_HOST: process.env.CLAMAV_HOST || 'localhost',
    CLAMAV_PORT: parseInt(process.env.CLAMAV_PORT || '3310', 10),
  },

  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  LOG: {
    LEVEL: process.env.LOG_LEVEL || 'info',
  },

  METRICS: {
    PORT: parseInt(process.env.METRICS_PORT || '9094', 10),
    PATH: process.env.METRICS_PATH || '/metrics',
  },
} as const;

export default config;
