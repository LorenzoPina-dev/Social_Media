/**
 * Kafka Configuration — kafkajs producer + consumer
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

    producer = kafkaInstance.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });
    await producer.connect();
    logger.info('✅ Kafka producer connected successfully');

    consumer = kafkaInstance.consumer({
      groupId: config.KAFKA_GROUP_ID,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      allowAutoTopicCreation: true,
    });
    await consumer.connect();
    logger.info('✅ Kafka consumer connected successfully');

    await consumer.subscribe({
      topics: ['user_events', 'moderation_events', 'interaction_events'],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value?.toString();
          if (!value) return;
          const event = JSON.parse(value);
          logger.info('Kafka message received', { topic, partition, event: event.type });

          // Handlers are registered dynamically via setMessageHandler()
          const handler = messageHandlers.get(topic);
          if (handler) await handler(event);
        } catch (error) {
          logger.error('Failed to process Kafka message', { error, topic });
        }
      },
    });
  } catch (error) {
    logger.error('❌ Failed to connect to Kafka', { error });
    throw error;
  }
}

// Map topic → handler function
const messageHandlers = new Map<string, (event: unknown) => Promise<void>>();

export function registerKafkaHandler(
  topic: string,
  handler: (event: unknown) => Promise<void>,
): void {
  messageHandlers.set(topic, handler);
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
    logger.error('Error disconnecting from Kafka', { error });
  }
}

export { kafka, producer, consumer };
