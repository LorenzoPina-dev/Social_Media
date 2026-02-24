/**
 * Global Mock — ioredis
 * Usato automaticamente da Jest per tutti i test che importano 'ioredis'.
 */

const mockRedisInstance = {
  get:    jest.fn().mockResolvedValue(null),
  set:    jest.fn().mockResolvedValue('OK'),
  setex:  jest.fn().mockResolvedValue('OK'),
  del:    jest.fn().mockResolvedValue(1),
  keys:   jest.fn().mockResolvedValue([]),
  incr:   jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl:    jest.fn().mockResolvedValue(60),
  ping:   jest.fn().mockResolvedValue('PONG'),
  quit:   jest.fn().mockResolvedValue('OK'),
  zincrby:          jest.fn().mockResolvedValue('1'),
  zrevrangebyscore: jest.fn().mockResolvedValue([]),
  zscore:           jest.fn().mockResolvedValue(null),
  on:      jest.fn().mockReturnThis(),
  connect: jest.fn().mockResolvedValue(undefined),
  pipeline: jest.fn().mockReturnValue({
    zincrby: jest.fn().mockReturnThis(),
    expire:  jest.fn().mockReturnThis(),
    exec:    jest.fn().mockResolvedValue([]),
  }),
};

const Redis = jest.fn().mockImplementation(() => mockRedisInstance);

module.exports = Redis;
module.exports.default = Redis;
