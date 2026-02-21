/**
 * Notification Service Configuration
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
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateEnv();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3007', 10),
  SERVICE_NAME: 'notification-service',
  VERSION: process.env.npm_package_version || '1.0.0',

  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

  DATABASE_URL: process.env.DATABASE_URL!,
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || '2', 10),
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '10', 10),
  DB_IDLE_TIMEOUT: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  DB_CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),

  REDIS_URL: process.env.REDIS_URL!,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_TLS: process.env.REDIS_TLS === 'true',

  KAFKA_BROKERS: process.env.KAFKA_BROKERS!.split(','),
  KAFKA_CLIENT_ID: 'notification-service',
  KAFKA_GROUP_ID: 'notification-service-group',

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,

  FCM: {
    SERVER_KEY: process.env.FCM_SERVER_KEY || '',
  },

  APNS: {
    KEY_ID: process.env.APNS_KEY_ID || '',
    TEAM_ID: process.env.APNS_TEAM_ID || '',
    BUNDLE_ID: process.env.APNS_BUNDLE_ID || 'com.example.socialmedia',
  },

  SMTP: {
    HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    USER: process.env.SMTP_USER || '',
    PASS: process.env.SMTP_PASS || '',
    FROM: process.env.EMAIL_FROM || 'Social Media <noreply@example.com>',
  },

  CACHE: {
    UNREAD_COUNT_TTL: 300,    // 5 minuti
    WS_SESSION_TTL: 3600,     // 1 ora
  },

  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  LOG: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    PRETTY_PRINT: process.env.LOG_PRETTY_PRINT === 'true',
  },

  METRICS: {
    PORT: parseInt(process.env.METRICS_PORT || '9097', 10),
    PATH: process.env.METRICS_PATH || '/metrics',
  },
} as const;

export default config;
