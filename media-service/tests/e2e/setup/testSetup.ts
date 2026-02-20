/**
 * E2E Per-test Setup — media-service
 *
 * Runs before each E2E test FILE (setupFilesAfterEnv).
 * Silences logger and mocks only the external side-effects that are
 * genuinely unavailable in CI without extra infra (Kafka, Redis).
 *
 * Real PostgreSQL IS used — that is the point of E2E.
 * StorageService runs in stub mode (no MinIO needed).
 */

// ─── Silence logger so test output stays clean ────────────────────────────────
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── Silence metrics server ───────────────────────────────────────────────────
jest.mock('../../../src/utils/metrics', () => ({
  startMetricsServer: jest.fn(),
  mediaMetrics: {
    uploadsTotal: { inc: jest.fn() },
    processingJobsTotal: { inc: jest.fn() },
    storageBytesTotal: { set: jest.fn() },
    requestDuration: { observe: jest.fn() },
  },
}));

// ─── Mock Kafka — no broker needed in tests ───────────────────────────────────
jest.mock('../../../src/config/kafka', () => ({
  connectKafka: jest.fn().mockResolvedValue(undefined),
  disconnectKafka: jest.fn().mockResolvedValue(undefined),
  getKafkaProducer: jest.fn().mockReturnValue({
    send: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  }),
  getKafkaConsumer: jest.fn().mockReturnValue({
    connect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  }),
  registerKafkaHandler: jest.fn(),
}));

// ─── Mock Redis — no Redis needed in tests ────────────────────────────────────
jest.mock('../../../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
  getRedisClient: jest.fn().mockReturnValue({
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(undefined),
  }),
}));

// ─── Set required env vars ────────────────────────────────────────────────────
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0'; // random port
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:password@localhost:5432/media_test_db';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.KAFKA_BROKERS = 'localhost:9092';
  process.env.JWT_ACCESS_SECRET = 'e2e-test-secret-key';
  process.env.STORAGE_TYPE = 'minio';
  process.env.AWS_ACCESS_KEY_ID = 'minioadmin';
  process.env.AWS_SECRET_ACCESS_KEY = 'minioadmin';
  process.env.AWS_S3_BUCKET = 'test-bucket';
  process.env.MINIO_ENDPOINT = 'http://localhost:9000';
  process.env.CDN_BASE_URL = 'http://localhost:9000/test-bucket';
  process.env.VIRUS_SCAN_ENABLED = 'false';
  process.env.MAX_FILE_SIZE_BYTES = '52428800';
  process.env.ALLOWED_IMAGE_TYPES = 'image/jpeg,image/png,image/gif,image/webp';
  process.env.ALLOWED_VIDEO_TYPES = 'video/mp4,video/quicktime,video/webm';
});
