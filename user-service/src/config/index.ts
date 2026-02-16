/**
 * User Service Configuration
 * 
 * Centralized configuration with environment variable validation
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Validate required environment variables
 */
function validateEnv(): void {
  const required = [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'REDIS_URL',
    'KAFKA_BROKERS',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateEnv();

export const config = {
  // General
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3002', 10),
  SERVICE_NAME: 'user-service',
  VERSION: process.env.npm_package_version || '1.0.0',

  // CORS
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

  // Database
  DATABASE_URL: process.env.DATABASE_URL!,
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || '5', 10),
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '20', 10),
  DB_IDLE_TIMEOUT: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  DB_CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),

  // Redis
  REDIS_URL: process.env.REDIS_URL!,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_TLS: process.env.REDIS_TLS === 'true',

  // Kafka
  KAFKA_BROKERS: process.env.KAFKA_BROKERS!.split(','),
  KAFKA_CLIENT_ID: 'user-service',
  KAFKA_GROUP_ID: 'user-service-group',

  // Cache
  CACHE: {
    PROFILE_TTL: 3600, // 1 hour
    FOLLOWERS_TTL: 300, // 5 minutes
    SEARCH_TTL: 600, // 10 minutes
  },

  // GDPR
  GDPR: {
    SOFT_DELETE_GRACE_PERIOD: 2592000, // 30 days in seconds
    DATA_EXPORT_FORMAT: 'json' as const,
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Logging
  LOG: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    PRETTY_PRINT: process.env.LOG_PRETTY_PRINT === 'true',
  },

  // Metrics
  METRICS: {
    PORT: parseInt(process.env.METRICS_PORT || '9092', 10),
    PATH: process.env.METRICS_PATH || '/metrics',
  },

  // Tracing
  TRACING: {
    ENABLED: process.env.TRACING_ENABLED === 'true',
    JAEGER_ENDPOINT: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    SAMPLE_RATE: parseFloat(process.env.TRACING_SAMPLE_RATE || '0.1'),
  },

  // Pagination
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
  },
} as const;

export default config;
