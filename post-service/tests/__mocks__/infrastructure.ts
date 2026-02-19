/**
 * Manual mock — Infrastructure (DB, Redis, Kafka)
 * Used in unit tests to avoid real connections
 */

export const mockDb = {
  raw: jest.fn().mockResolvedValue({ rows: [] }),
  destroy: jest.fn().mockResolvedValue(undefined),
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  whereNot: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([]),
  first: jest.fn().mockResolvedValue(null),
  increment: jest.fn().mockResolvedValue(1),
  decrement: jest.fn().mockResolvedValue(1),
};

export const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  ping: jest.fn().mockResolvedValue('PONG'),
  quit: jest.fn().mockResolvedValue('OK'),
};

export const mockKafkaProducer = {
  send: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
};

// Mock the config modules
jest.mock('../../src/config/database', () => ({
  getDatabase: jest.fn(() => mockDb),
  connectDatabase: jest.fn().mockResolvedValue(mockDb),
  disconnectDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn(() => mockRedis),
  connectRedis: jest.fn().mockResolvedValue(mockRedis),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/config/kafka', () => ({
  getKafkaProducer: jest.fn(() => mockKafkaProducer),
  connectKafka: jest.fn().mockResolvedValue(undefined),
  disconnectKafka: jest.fn().mockResolvedValue(undefined),
  registerKafkaHandler: jest.fn(),
}));
