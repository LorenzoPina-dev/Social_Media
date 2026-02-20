import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { config } from './index';
import { logger } from '../utils/logger';

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let consumer: Consumer | null = null;

export function getKafka(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: config.serviceName,
      brokers: config.kafka.brokers,
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 300,
        retries: 10,
      },
    });
  }
  return kafka;
}

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    producer = getKafka().producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
    });
    await producer.connect();
    logger.info('Kafka producer connected');
  }
  return producer;
}

export async function getConsumer(): Promise<Consumer> {
  if (!consumer) {
    consumer = getKafka().consumer({
      groupId: config.kafka.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
    await consumer.connect();
    logger.info('Kafka consumer connected');
  }
  return consumer;
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}
