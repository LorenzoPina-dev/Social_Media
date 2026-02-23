/**
 * Kafka Configuration
 * Producer and Consumer setup for event streaming
 */

import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { config } from './index';
import { logger } from '../utils/logger';
import { AuthEvent } from '../types';
import { UserEventConsumer } from '../kafka/consumers/user.consumer';

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let consumer: Consumer | null = null;

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
 * Connect Kafka producer and consumer
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

    // Subscribe to relevant topics (with error handling)
    // Topics will be created automatically if they don't exist
    try {
      // Istanzia il consumer formale che gestisce user_events
      const userEventConsumer = new UserEventConsumer();

      await consumer.subscribe({
        topics: ['user_events', 'password_reset_requested'],
        fromBeginning: false,
      });
      logger.info('✅ Subscribed to Kafka topics: user_events, password_reset_requested');

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const value = message.value?.toString();
            if (!value) return;

            const event = JSON.parse(value) as AuthEvent;
            logger.debug('Kafka message received', { topic, partition, eventType: event.type });

            switch (topic) {
              case 'user_events':
                // Delega al consumer formale (GDPR: sessioni + reset token)
                await userEventConsumer.processMessage(event);
                break;
              case 'password_reset_requested':
                await handlePasswordResetEvent(event);
                break;
              default:
                logger.warn('Unknown topic', { topic });
            }
          } catch (error) {
            logger.error('Failed to process Kafka message', { error, topic });
            // Non rilanciare: evita loop infiniti su messaggi corrotti
          }
        },
      });
    } catch (error) {
      logger.warn('⚠️  Could not subscribe to Kafka topics, consumer will not run', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Service può partire anche senza consumer
    }

  } catch (error) {
    logger.warn('⚠️  Kafka connection failed, service will continue without Kafka', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    // Don't throw - allow service to start without Kafka
    // Kafka will be unavailable but service can still handle HTTP requests
  }
}

/**
 * Handle password reset events
 */
async function handlePasswordResetEvent(event: AuthEvent): Promise<void> {
  logger.info('Handling password reset event', { eventType: event.type });

  // The actual reset flow is HTTP-driven; this consumer logs the audit trail.
  // If email integration is added, this is where we'd dispatch the email.
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
  } catch (error) {
    logger.error('Error disconnecting from Kafka', { error });
  }
}

export { kafka, producer, consumer };
