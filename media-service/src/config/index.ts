/**
 * Media Service Configuration
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function validateEnv(): void {
  const required = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'REDIS_URL', 'KAFKA_BROKERS', 'JWT_ACCESS_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateEnv();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3004', 10),
  SERVICE_NAME: 'media-service',
  VERSION: process.env.npm_package_version || '1.0.0',

  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

  DATABASE_URL: process.env.DATABASE_URL!,
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || '5', 10),
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '20', 10),
  DB_IDLE_TIMEOUT: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  DB_CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),

  REDIS_URL: process.env.REDIS_URL!,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_TLS: process.env.REDIS_TLS === 'true',

  KAFKA_BROKERS: process.env.KAFKA_BROKERS!.split(','),
  KAFKA_CLIENT_ID: 'media-service',
  KAFKA_GROUP_ID: 'media-service-group',

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,

  STORAGE: {
    TYPE: (process.env.STORAGE_TYPE || 'minio') as 'minio' | 's3',
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'social-media-uploads',
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
    CDN_BASE_URL: process.env.CDN_BASE_URL || 'http://localhost:9000/social-media-uploads',
    PRESIGNED_URL_EXPIRY: 3600, // 1 hour in seconds
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
