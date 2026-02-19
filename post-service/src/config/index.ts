/**
 * Post Service Configuration
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function validateEnv(): void {
  const required = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'REDIS_URL', 'KAFKA_BROKERS'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateEnv();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3003', 10),
  SERVICE_NAME: 'post-service',
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
  KAFKA_CLIENT_ID: 'post-service',
  KAFKA_GROUP_ID: 'post-service-group',

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'secret',

  CACHE: {
    POST_TTL: 300,          // 5 minutes
    TRENDING_TTL: 3600,     // 1 hour
  },

  POST: {
    MAX_CONTENT_LENGTH: 2000,
    MAX_HASHTAGS: 30,
  },

  SCHEDULER_INTERVAL_MS: parseInt(process.env.SCHEDULER_INTERVAL_MS || '60000', 10),

  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_WINDOW_MS: 900000, // 15 minutes
  },

  LOG: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    PRETTY_PRINT: process.env.LOG_PRETTY_PRINT === 'true',
  },

  METRICS: {
    PORT: parseInt(process.env.METRICS_PORT || '9093', 10),
    PATH: process.env.METRICS_PATH || '/metrics',
  },

  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
  },
} as const;

export default config;
