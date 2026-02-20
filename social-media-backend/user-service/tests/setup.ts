/**
 * Jest Global Setup
 *
 * Eseguito PRIMA di qualsiasi import di modulo (setupFiles, non setupFilesAfterFramework).
 * Imposta le variabili d'ambiente richieste da config/index.ts
 * in modo che validateEnv() non lanci eccezioni nei test unit/integration/e2e
 * (tutti usano servizi mockati, quindi le URL non devono essere raggiungibili).
 *
 * Per test INTEGRATION con DB reale, impostare TEST_DATABASE_URL nell'ambiente
 * prima di eseguire `npm run test:integration`.
 */
process.env.NODE_ENV            = 'test';
process.env.PORT                = '3002';
process.env.DATABASE_URL        = process.env.TEST_DATABASE_URL
  ?? 'postgresql://postgres:postgres@localhost:5432/user_test_db';
process.env.REDIS_URL           = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379';
process.env.KAFKA_BROKERS       = process.env.TEST_KAFKA_BROKERS ?? 'localhost:9092';
process.env.JWT_ACCESS_SECRET   = 'test-access-secret-min-32-chars-long!!';
process.env.LOG_LEVEL           = 'silent';
process.env.LOG_PRETTY_PRINT    = 'false';
process.env.METRICS_PORT        = '9099';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';
process.env.CORS_ORIGINS        = 'http://localhost:3000';
