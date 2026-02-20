/**
 * Test setup — media-service
 */

// Silence logger in tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Silence metrics in tests
jest.mock('../src/utils/metrics', () => ({
  startMetricsServer: jest.fn(),
  mediaMetrics: {
    uploadsTotal: { inc: jest.fn() },
    processingJobsTotal: { inc: jest.fn() },
    storageBytesTotal: { set: jest.fn() },
    requestDuration: { observe: jest.fn() },
  },
}));

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '3004';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/media_test_db';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.KAFKA_BROKERS = 'localhost:9092';
  process.env.JWT_ACCESS_SECRET = 'test-secret';
  process.env.STORAGE_TYPE = 'minio';
  process.env.AWS_ACCESS_KEY_ID = 'minioadmin';
  process.env.AWS_SECRET_ACCESS_KEY = 'minioadmin';
  process.env.AWS_S3_BUCKET = 'test-bucket';
  process.env.MINIO_ENDPOINT = 'http://localhost:9000';
  process.env.CDN_BASE_URL = 'http://localhost:9000/test-bucket';
});

afterAll(async () => {
  // clean up
});
