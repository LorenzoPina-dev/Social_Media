/**
 * Interaction Service Configuration
 *
 * Centralized configuration with environment variable validation
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function validateEnv(): void {
  const required = [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'REDIS_URL',
    'KAFKA_BROKERS',
    'JWT_ACCESS_SECRET',
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
  PORT: parseInt(process.env.PORT || '3005', 10),
  SERVICE_NAME: 'interaction-service',
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
  KAFKA_CLIENT_ID: 'interaction-service',
  KAFKA_GROUP_ID: 'interaction-service-group',

  // JWT
  JWT: {
    ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
    ISSUER: process.env.JWT_ISSUER || 'auth-service',
  },

  // Cache TTLs (seconds)
  CACHE: {
    LIKES_COUNT_TTL: 60,        // flush to DB every 60s
    COMMENTS_COUNT_TTL: 60,
    USER_LIKES_TTL: 3600,
    COUNTER_FLUSH_INTERVAL: 60, // seconds
  },

  // Business rules
  BUSINESS: {
    COMMENT_MAX_LENGTH: 1000,
    COMMENT_MAX_DEPTH: 3,
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Logging
  LOG: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    PRETTY_PRINT: process.env.LOG_PRETTY_PRINT === 'true',
  },

  // Metrics
  METRICS: {
    PORT: parseInt(process.env.METRICS_PORT || '9095', 10),
    PATH: process.env.METRICS_PATH || '/metrics',
  },
} as const;

export default config;
