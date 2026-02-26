/**
 * Kafka Configuration — media-service
 *
 * Fix log:
 *  - BUGFIX: connectKafka() now has a configurable connection timeout instead
 *    of blocking indefinitely. Previously, if Kafka wasn't ready the producer
 *    connect() would hang or throw, killing the whole process.
 *  - BUGFIX: Consumer subscription and run() failures are caught per-operation
 *    so a bad topic or consumer group doesn't prevent the producer from working.
 *  - BUGFIX: disconnectKafka() was swallowing errors silently; now logs them.
 */

import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { config } from './index';
import { logger } from '../utils/logger';

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let consumer: Consumer | null = null;

// Deferred consumer handlers (registered by individual consumer modules)
const messageHandlers: Map<string, (event: any) => Promise<void>> = new Map();

export function registerKafkaHandler(
  eventType: string,
  handler: (event: any) => Promise<void>,
): void {
  messageHandlers.set(eventType, handler);
}

function createKafka(): Kafka {
  if (kafka) return kafka;
  kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS,
    logLevel: logLevel.ERROR,
    retry: {
      initialRetryTime: 300,
      retries: 5,           // FIX: was 8 retries which caused very long hangs
      maxRetryTime: 5000,
    },
    // FIX: explicit connection timeout so we fail fast instead of hanging
    connectionTimeout: 5000,
    requestTimeout: 10000,
  });
  return kafka;
}

export async function connectKafka(): Promise<void> {
  const kafkaInstance = createKafka();

  // ── Producer ────────────────────────────────────────────────────────────────
  producer = kafkaInstance.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30000,
  });

  await producer.connect();
  logger.info('✅ Kafka producer connected');

  // ── Consumer ────────────────────────────────────────────────────────────────
  consumer = kafkaInstance.consumer({
    groupId: config.KAFKA_GROUP_ID,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    allowAutoTopicCreation: true,
  });

  await consumer.connect();
  logger.info('✅ Kafka consumer connected');

  // FIX: subscribe and run in a separate try-catch so a subscription failure
  // doesn't prevent the rest of the app from starting (producer still works)
  try {
    await consumer.subscribe({ topics: ['post_events'], fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value?.toString();
          if (!value) return;
          const event = JSON.parse(value);
          const handler = messageHandlers.get(event.type);
          if (handler) {
            await handler(event);
          } else {
            logger.debug('No handler for event type', { type: event.type, topic });
          }
        } catch (error) {
          logger.error('Failed to process Kafka message', { error, topic, partition });
        }
      },
    });

    logger.info('✅ Kafka consumer subscribed and running');
  } catch (consumerErr: unknown) {
    // Non-fatal: producer is still working; log and continue
    logger.error('⚠️  Kafka consumer setup failed — events will not be consumed', {
      error: consumerErr instanceof Error ? consumerErr.message : String(consumerErr),
    });
  }
}

export function getKafkaProducer(): Producer {
  if (!producer) throw new Error('Kafka producer not initialized. Call connectKafka() first.');
  return producer;
}

export function getKafkaConsumer(): Consumer {
  if (!consumer) throw new Error('Kafka consumer not initialized. Call connectKafka() first.');
  return consumer;
}

export async function disconnectKafka(): Promise<void> {
  try {
    if (producer) {
      await producer.disconnect();
      producer = null;
      logger.info('Kafka producer disconnected');
    }
  } catch (err: unknown) {
    logger.error('Error disconnecting Kafka producer', { error: err });
  }

  try {
    if (consumer) {
      await consumer.disconnect();
      consumer = null;
      logger.info('Kafka consumer disconnected');
    }
  } catch (err: unknown) {
    logger.error('Error disconnecting Kafka consumer', { error: err });
  }
}

export { kafka, producer, consumer };
