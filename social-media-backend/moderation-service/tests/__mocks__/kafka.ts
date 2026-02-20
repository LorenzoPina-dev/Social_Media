// Mock per src/config/kafka.ts
const mockProducer = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  send: jest.fn().mockResolvedValue(undefined),
};

const mockConsumer = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  run: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../src/config/kafka', () => ({
  getKafka: jest.fn(),
  getProducer: jest.fn().mockResolvedValue(mockProducer),
  getConsumer: jest.fn().mockResolvedValue(mockConsumer),
  disconnectKafka: jest.fn().mockResolvedValue(undefined),
}));

export { mockProducer, mockConsumer };
