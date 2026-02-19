/**
 * Jest Global Setup — Post Service Tests
 */
process.env.NODE_ENV            = 'test';
process.env.PORT                = '3003';
process.env.DATABASE_URL        = process.env.TEST_DATABASE_URL
  ?? 'postgresql://postgres:postgres@localhost:5432/post_test_db';
process.env.REDIS_URL           = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379';
process.env.KAFKA_BROKERS       = process.env.TEST_KAFKA_BROKERS ?? 'localhost:9092';
process.env.JWT_ACCESS_SECRET   = 'test-access-secret-min-32-chars-long!!';
process.env.LOG_LEVEL           = 'silent';
process.env.LOG_PRETTY_PRINT    = 'false';
process.env.METRICS_PORT        = '9099';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';
process.env.CORS_ORIGINS        = 'http://localhost:3000';
process.env.SCHEDULER_INTERVAL_MS = '60000';
