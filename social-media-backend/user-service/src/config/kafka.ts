/**
 * Kafka Configuration
 * Producer and Consumer setup
 */

import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { config } from './index';
import { logger } from '../utils/logger';
import { AuthConsumer } from '../kafka/consumers/auth.consumer';

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let consumer: Consumer | null = null;
let authConsumer: AuthConsumer | null = null;

/**
 * Create Kafka instance
 */
function createKafka(): Kafka {
  if (kafka) {
    return kafka;
  }

  kafka = new Kafka({
    clientId: config.KAFKA_CLIENT_ID,
    brokers: config.KAFKA_BROKERS,
    logLevel: logLevel.ERROR,
    retry: {
      initialRetryTime: 100,
      retries: 8,
    },
  });

  return kafka;
}

/**
 * Inizializza i consumer con le dipendenze (chiamato dopo setupRoutes)
 */
export function initConsumers(userService: import('../services/user.service').UserService): void {
  authConsumer = new AuthConsumer(userService);
  logger.info('Kafka consumers initialized');
}

/**
 * Connect Kafka producer
 */
export async function connectKafka(): Promise<void> {
  try {
    const kafkaInstance = createKafka();

    // Create producer
    producer = kafkaInstance.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });

    await producer.connect();
    logger.info('✅ Kafka producer connected successfully');

    // Create consumer
    consumer = kafkaInstance.consumer({
      groupId: config.KAFKA_GROUP_ID,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      allowAutoTopicCreation: true,
    });

    await consumer.connect();
    logger.info('✅ Kafka consumer connected successfully');

    // Subscribe to relevant topics
    await consumer.subscribe({
      topics: ['auth_events', 'user_deletion_requested'],
      fromBeginning: false,
    });

    // Start consuming
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const value = message.value;
        if (!value) return;

        try {
          const eventType = JSON.parse(value.toString())?.type ?? 'unknown';
          logger.info('Kafka message received', { topic, partition, eventType });

          if (topic === 'auth_events') {
            if (!authConsumer) {
              logger.warn('authConsumer not initialized yet — message skipped', { eventType });
              return;
            }
            await authConsumer.processMessage(value);
          } else {
            logger.warn('No handler registered for topic', { topic });
          }
        } catch (error) {
          logger.error('Failed to process Kafka message', { error, topic });
          // non rilanciare: Kafka non ha DLQ configurato, evita loop infiniti
        }
      },
    });

  } catch (error) {
    logger.error('❌ Failed to connect to Kafka', { error });
    throw error;
  }
}

/**
 * Get Kafka producer
 */
export function getKafkaProducer(): Producer {
  if (!producer) {
    throw new Error('Kafka producer not initialized. Call connectKafka() first.');
  }
  return producer;
}

/**
 * Get Kafka consumer
 */
export function getKafkaConsumer(): Consumer {
  if (!consumer) {
    throw new Error('Kafka consumer not initialized. Call connectKafka() first.');
  }
  return consumer;
}

/**
 * Disconnect from Kafka
 */
export async function disconnectKafka(): Promise<void> {
  try {
    if (producer) {
      await producer.disconnect();
      producer = null;
      logger.info('Kafka producer disconnected');
    }

    if (consumer) {
      await consumer.disconnect();
      consumer = null;
      logger.info('Kafka consumer disconnected');
    }

    authConsumer = null;
  } catch (error) {
    logger.error('Error disconnecting from Kafka', { error });
  }
}

export { kafka, producer, consumer };
