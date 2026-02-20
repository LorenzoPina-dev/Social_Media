// Mock per src/config/redis.ts
const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

jest.mock('../../src/config/redis', () => ({
  getRedis: jest.fn().mockReturnValue(mockRedis),
  closeRedis: jest.fn().mockResolvedValue(undefined),
}));

export { mockRedis };
