/**
 * Jest Global Setup — imposta le ENV vars PRIMA di qualsiasi import di modulo.
 * In questo modo config/index.ts non lancia eccezioni durante i test.
 */

process.env.NODE_ENV              = 'test';
process.env.PORT                  = '3008';
process.env.SERVICE_NAME          = 'search-service';
process.env.REDIS_URL             = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379';
process.env.ELASTICSEARCH_URL     = process.env.TEST_ES_URL ?? 'http://localhost:9200';
process.env.ELASTICSEARCH_INDEX_PREFIX = 'test_';
process.env.KAFKA_BROKERS         = process.env.TEST_KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID       = 'search-service-test';
process.env.KAFKA_GROUP_ID        = 'search-service-test-group';
process.env.JWT_ACCESS_SECRET     = 'test-access-secret-must-be-at-least-32chars!!';
process.env.AUTOCOMPLETE_CACHE_TTL = '300';
process.env.TRENDING_CACHE_TTL    = '3600';
process.env.RATE_LIMIT_WINDOW_MS  = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.LOG_LEVEL             = 'silent';
process.env.LOG_PRETTY_PRINT      = 'false';
process.env.METRICS_PORT          = '9099';
process.env.CORS_ORIGINS          = 'http://localhost:3000';
