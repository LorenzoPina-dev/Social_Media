/**
 * Kafka mock for unit tests
 */

export const kafkaMock = {
  connectKafka: jest.fn().mockResolvedValue(undefined),
  getKafkaConsumer: jest.fn(),
  disconnectKafka: jest.fn().mockResolvedValue(undefined),
  kafka: null,
  consumer: null,
};

jest.mock('../src/config/kafka', () => kafkaMock);

export default kafkaMock;
