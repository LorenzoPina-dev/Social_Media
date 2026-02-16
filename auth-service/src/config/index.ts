/**
 * Auth Service Configuration
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
    ACCESS_TOKEN_TTL: parseInt(process.env.JWT_ACCESS_TOKEN_TTL || '900', 10), // 15 minutes
    REFRESH_TOKEN_TTL: parseInt(process.env.JWT_REFRESH_TOKEN_TTL || '2592000', 10), // 30 days
    SLIDING_WINDOW: parseInt(process.env.JWT_SLIDING_WINDOW || '604800', 10), // 7 days
    ALGORITHM: (process.env.JWT_ALGORITHM || 'HS256') as 'HS256' | 'RS256',
    ISSUER: process.env.JWT_ISSUER || 'social-media-platform',
    AUDIENCE: process.env.JWT_AUDIENCE || 'social-media-api',
  },

  // Password Security
  PASSWORD: {
    MIN_LENGTH: parseInt(process.env.PASSWORD_MIN_LENGTH || '12', 10),
    REQUIRE_UPPERCASE: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    REQUIRE_LOWERCASE: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    REQUIRE_NUMBER: process.env.PASSWORD_REQUIRE_NUMBER !== 'false',
    REQUIRE_SPECIAL: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
    HASH_ALGORITHM: (process.env.PASSWORD_HASH_ALGORITHM || 'argon2id') as 'argon2id' | 'bcrypt',
    ARGON2_MEMORY: parseInt(process.env.ARGON2_MEMORY || '65536', 10), // 64 MB
    ARGON2_ITERATIONS: parseInt(process.env.ARGON2_ITERATIONS || '3', 10),
    ARGON2_PARALLELISM: parseInt(process.env.ARGON2_PARALLELISM || '4', 10),
    PEPPER: process.env.PASSWORD_PEPPER || '',
  },

  // Rate Limiting
  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    LOGIN: {
      WINDOW_MS: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '900000', 10),
      MAX_ATTEMPTS: parseInt(process.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS || '5', 10),
      LOCKOUT_DURATION: parseInt(process.env.RATE_LIMIT_LOGIN_LOCKOUT_DURATION || '900000', 10),
    },
  },

  // MFA/2FA
  MFA: {
    TOTP_WINDOW: parseInt(process.env.MFA_TOTP_WINDOW || '2', 10),
    BACKUP_CODES_COUNT: parseInt(process.env.MFA_BACKUP_CODES_COUNT || '10', 10),
    ENFORCE_FOR_ADMIN: process.env.MFA_ENFORCE_FOR_ADMIN === 'true',
    ISSUER_NAME: process.env.MFA_ISSUER_NAME || 'Social Media Platform',
  },

  // Session Management
  SESSION: {
    L1_CACHE_TTL: parseInt(process.env.SESSION_L1_CACHE_TTL || '60', 10), // 1 minute
    L2_CACHE_TTL: parseInt(process.env.SESSION_L2_CACHE_TTL || '86400', 10), // 24 hours
    MAX_DEVICES_PER_USER: parseInt(process.env.SESSION_MAX_DEVICES_PER_USER || '5', 10),
  },

  // OAuth2
  OAUTH2: {
    GOOGLE: {
      CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
      CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
      CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/v1/auth/google/callback',
    },
    APPLE: {
      CLIENT_ID: process.env.APPLE_CLIENT_ID || '',
      CLIENT_SECRET: process.env.APPLE_CLIENT_SECRET || '',
      CALLBACK_URL: process.env.APPLE_CALLBACK_URL || 'http://localhost:3001/api/v1/auth/apple/callback',
    },
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
