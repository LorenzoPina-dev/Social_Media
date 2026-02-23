/**
 * Search Service Configuration
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function validateEnv(): void {
  const required = [
    'NODE_ENV',
    'PORT',
    'REDIS_URL',
    'ELASTICSEARCH_URL',
    'KAFKA_BROKERS',
    'JWT_ACCESS_SECRET',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

validateEnv();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3008', 10),
  SERVICE_NAME: process.env.SERVICE_NAME || 'search-service',
  VERSION: process.env.npm_package_version || '1.0.0',

  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

  // Redis
  REDIS_URL: process.env.REDIS_URL!,

  // Elasticsearch
  ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL!,
  ELASTICSEARCH_INDEX_PREFIX: process.env.ELASTICSEARCH_INDEX_PREFIX || '',

  // Kafka (consumer only — no producer)
  KAFKA_BROKERS: process.env.KAFKA_BROKERS!.split(','),
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'search-service',
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'search-service-group',

  // JWT (validation only)
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,

  // Cache TTLs (seconds)
  CACHE: {
    AUTOCOMPLETE_TTL: parseInt(process.env.AUTOCOMPLETE_CACHE_TTL || '300', 10),
    TRENDING_TTL: parseInt(process.env.TRENDING_CACHE_TTL || '3600', 10),
  },

  // Rate limiting
  RATE_LIMIT: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Search defaults
  SEARCH: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MIN_QUERY_LENGTH: 1,
    FUZZY_PREFIX_LENGTH: 2,
    TRENDING_TOP_N: 20,
  },

  LOG: {
    LEVEL: process.env.LOG_LEVEL || 'info',
    PRETTY_PRINT: process.env.LOG_PRETTY_PRINT === 'true',
  },

  METRICS: {
    PORT: parseInt(process.env.METRICS_PORT || '9098', 10),
    PATH: process.env.METRICS_PATH || '/metrics',
  },
} as const;

export default config;
