/**
 * Jest Global Setup — interaction-service
 *
 * Imposta le env vars PRIMA che qualsiasi modulo venga importato.
 */
process.env.NODE_ENV            = 'test';
process.env.PORT                = '3005';
process.env.DATABASE_URL        = process.env.TEST_DATABASE_URL
  ?? 'postgresql://postgres:postgres@localhost:5432/interaction_test_db';
process.env.REDIS_URL           = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379';
process.env.KAFKA_BROKERS       = process.env.TEST_KAFKA_BROKERS ?? 'localhost:9092';
process.env.JWT_ACCESS_SECRET   = 'test-access-secret-must-be-at-least-32chars!';
process.env.LOG_LEVEL           = 'silent';
process.env.LOG_PRETTY_PRINT    = 'false';
process.env.METRICS_PORT        = '9999';
process.env.RATE_LIMIT_WINDOW_MS    = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';
process.env.CORS_ORIGINS        = 'http://localhost:3000';
