/**
 * Feed Service Configuration
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function validateEnv(): void {
  const required = [
    'NODE_ENV',
    'PORT',
    'REDIS_URL',
    'KAFKA_BROKERS',
    'JWT_ACCESS_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

if (process.env.NODE_ENV !== 'test') {
  validateEnv();
}

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3006', 10),
  SERVICE_NAME: 'feed-service',
  VERSION: process.env.npm_package_version || '1.0.0',

  // CORS
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_TLS: process.env.REDIS_TLS === 'true',

  // Kafka
  KAFKA_BROKERS: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  KAFKA_CLIENT_ID: 'feed-service',
  KAFKA_GROUP_ID: 'feed-service-group',

  // JWT (for validating tokens, signed by auth-service)
  JWT: {
    ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev-secret',
  },

  // Feed settings
  FEED: {
    MAX_SIZE: parseInt(process.env.FEED_MAX_SIZE || '1000', 10),
    TTL_SECONDS: parseInt(process.env.FEED_TTL_SECONDS || '86400', 10),
    /** Users with followers above this threshold are treated as celebrities:
     *  their posts are NOT fanned out on write — followers pull them on read. */
    CELEBRITY_THRESHOLD: parseInt(process.env.CELEBRITY_THRESHOLD || '100000', 10),
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 50,
  },

  // Downstream service URLs
  SERVICES: {
    USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:3002',
    POST_SERVICE_URL: process.env.POST_SERVICE_URL || 'http://localhost:3003',
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Cache TTLs (seconds)
  CACHE: {
    FEED_TTL: parseInt(process.env.FEED_TTL_SECONDS || '86400', 10),
    CURSOR_TTL: 3600,
  },

  // Logging
  LOG: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    PRETTY_PRINT: process.env.LOG_PRETTY_PRINT === 'true',
  },

  // Metrics
  METRICS: {
    PORT: parseInt(process.env.METRICS_PORT || '9096', 10),
    PATH: process.env.METRICS_PATH || '/metrics',
  },
} as const;

export default config;
