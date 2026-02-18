// Deve girare PRIMA di qualsiasi import.
// Imposta le variabili d'ambiente richieste da src/config/index.ts.
process.env.NODE_ENV           = 'test';
process.env.PORT               = '3001';
process.env.DATABASE_URL       = 'postgresql://postgres:postgres@localhost:5432/test';
process.env.REDIS_URL          = 'redis://localhost:6379';
process.env.KAFKA_BROKERS      = 'localhost:9092';
process.env.JWT_ACCESS_SECRET  = 'test-access-secret-must-be-at-least-32!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-must-be-at-least-32!';
process.env.JWT_ACCESS_EXPIRY  = '15m';
process.env.JWT_REFRESH_EXPIRY = '30d';
process.env.LOG_LEVEL          = 'silent';
process.env.LOG_PRETTY_PRINT   = 'false';
process.env.METRICS_PORT       = '9099';
