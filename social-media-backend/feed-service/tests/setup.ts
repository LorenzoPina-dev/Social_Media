/**
 * Global test setup for feed-service
 * Sets environment variables before any module is imported.
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '3006';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.KAFKA_BROKERS = 'localhost:9092';
process.env.JWT_ACCESS_SECRET = 'test-jwt-secret';
process.env.USER_SERVICE_URL = 'http://localhost:3002';
process.env.POST_SERVICE_URL = 'http://localhost:3003';
process.env.FEED_MAX_SIZE = '1000';
process.env.FEED_TTL_SECONDS = '86400';
process.env.CELEBRITY_THRESHOLD = '100000';

// Silence logger in tests
jest.mock('../src/utils/logger', () => ({
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

// Silence metrics in tests
jest.mock('../src/utils/metrics', () => ({
  metrics: {
    incrementCounter: jest.fn(),
    setFeedSize: jest.fn(),
    recordRequestDuration: jest.fn(),
    getMetrics: jest.fn().mockResolvedValue(''),
  },
  startMetricsServer: jest.fn(),
  default: {
    incrementCounter: jest.fn(),
    setFeedSize: jest.fn(),
    recordRequestDuration: jest.fn(),
    getMetrics: jest.fn().mockResolvedValue(''),
  },
}));
