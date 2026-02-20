/**
 * Auth Service Configuration
 * 
 * Centralized configuration with environment variable validation
 */

import dotenv from 'dotenv';
import { SignOptions } from 'jsonwebtoken';
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
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
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
  PORT: parseInt(process.env.PORT || '3001', 10),
  SERVICE_NAME: 'auth-service',
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
  KAFKA_CLIENT_ID: 'auth-service',
  KAFKA_GROUP_ID: 'auth-service-group',

  // JWT Configuration
  JWT: {
    ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
    REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
    ACCESS_EXPIRY: (process.env.JWT_ACCESS_EXPIRY || '15m') as SignOptions['expiresIn'],
    REFRESH_EXPIRY: (process.env.JWT_REFRESH_EXPIRY || '30d') as SignOptions['expiresIn'],
    ALGORITHM: 'RS256' as const,
    ISSUER: 'auth-service',
  },

  // Password Configuration
  PASSWORD: {
    SALT_ROUNDS: parseInt(process.env.PASSWORD_SALT_ROUNDS || '12', 10),
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true,
  },

  // MFA Configuration
  MFA: {
    ENABLED: process.env.MFA_ENABLED === 'true',
    TOTP_WINDOW: 1,
    TOTP_STEP: 30,
    BACKUP_CODES_COUNT: 10,
  },

  // Session Configuration
  SESSION: {
    MAX_SESSIONS_PER_USER: 5,
    INACTIVITY_TIMEOUT: 1800, // 30 minutes
    ABSOLUTE_TIMEOUT: 86400, // 24 hours
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_WINDOW_MS: 900000, // 15 minutes
  },

  // OAuth2 Configuration
  OAUTH: {
    GOOGLE: {
      CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    },
    GITHUB: {
      CLIENT_ID: process.env.GITHUB_CLIENT_ID,
      CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
      CALLBACK_URL: process.env.GITHUB_CALLBACK_URL,
    },
  },

  // Cache TTLs
  CACHE: {
    SESSION_TTL: 3600, // 1 hour
    TOKEN_BLACKLIST_TTL: 86400, // 24 hours
    RATE_LIMIT_TTL: 900, // 15 minutes
  },

  // Logging
  LOG: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    PRETTY_PRINT: process.env.LOG_PRETTY_PRINT === 'true',
  },

  // Metrics
  METRICS: {
    PORT: parseInt(process.env.METRICS_PORT || '9091', 10),
    PATH: process.env.METRICS_PATH || '/metrics',
  },

  // Tracing
  TRACING: {
    ENABLED: process.env.TRACING_ENABLED === 'true',
    JAEGER_ENDPOINT: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    SAMPLE_RATE: parseFloat(process.env.TRACING_SAMPLE_RATE || '0.1'),
  },
} as const;

export default config;
