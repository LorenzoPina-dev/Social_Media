import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

// Override con DB di test
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/notification_test_db';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
process.env.KAFKA_BROKERS = 'localhost:9092';
process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-key-for-testing';
process.env.NODE_ENV = 'test';
process.env.PORT = '3007';

// Timeout globale per test async
jest.setTimeout(30000);
