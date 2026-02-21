/**
 * Kafka Configuration — Consumer per notification-service
 * Consuma: interaction_events, user_events, post_events, moderation_events
 */

import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { config } from './index';
import { logger } from '../utils/logger';

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let consumer: Consumer | null = null;

function createKafka(): Kafka {
  if (kafka) return kafka;
  kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS,
    logLevel: logLevel.ERROR,
    retry: { initialRetryTime: 100, retries: 8 },
  });
  return kafka;
}

export async function connectKafka(): Promise<void> {
  try {
    const kafkaInstance = createKafka();

    producer = kafkaInstance.producer({ allowAutoTopicCreation: true });
    await producer.connect();
    logger.info('✅ Kafka producer connected');

    consumer = kafkaInstance.consumer({
      groupId: config.KAFKA_GROUP_ID,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      allowAutoTopicCreation: true,
    });
    await consumer.connect();
    logger.info('✅ Kafka consumer connected');

    // Subscribes are handled by individual consumer classes
  } catch (error) {
    logger.warn('⚠️  Kafka connection failed, continuing without Kafka', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export function getKafkaProducer(): Producer {
  if (!producer) throw new Error('Kafka producer not initialized.');
  return producer;
}

export function getKafkaConsumer(): Consumer {
  if (!consumer) throw new Error('Kafka consumer not initialized.');
  return consumer;
}

export async function disconnectKafka(): Promise<void> {
  try {
    if (producer) { await producer.disconnect(); producer = null; }
    if (consumer) { await consumer.disconnect(); consumer = null; }
    logger.info('Kafka disconnected');
  } catch (error) {
    logger.error('Error disconnecting Kafka', { error });
  }
}

export { kafka, producer, consumer };
