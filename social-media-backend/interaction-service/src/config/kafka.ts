/**
 * Kafka Configuration
 */

import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { config } from './index';
import { logger } from '../utils/logger';
import { PostEventConsumer } from '../kafka/consumers/post.consumer';
import { UserEventConsumer } from '../kafka/consumers/user.consumer';

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
    const k = createKafka();

    producer = k.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });
    await producer.connect();
    logger.info('✅ Kafka producer connected successfully');

    consumer = k.consumer({
      groupId: config.KAFKA_GROUP_ID,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      allowAutoTopicCreation: true,
    });
    await consumer.connect();
    logger.info('✅ Kafka consumer connected successfully');

    try {
      // Istanzia i consumer formali con tutta la logica di business
      const postEventConsumer = new PostEventConsumer();
      const userEventConsumer = new UserEventConsumer();

      await consumer.subscribe({
        topics: ['post_events', 'user_events'],
        fromBeginning: false,
      });
      logger.info('✅ Subscribed to Kafka topics: post_events, user_events');

      await consumer.run({
        eachMessage: async ({ topic, message }) => {
          try {
            const value = message.value?.toString();
            if (!value) return;
            const event = JSON.parse(value);
            logger.debug('Kafka message received', { topic, eventType: event.type });

            if (topic === 'post_events') {
              await postEventConsumer.processMessage(event);
            } else if (topic === 'user_events') {
              await userEventConsumer.processMessage(event);
            } else {
              logger.warn('No handler for topic', { topic });
            }
          } catch (error) {
            logger.error('Failed to process Kafka message', { error, topic });
            // Non rilanciare: evita loop infiniti su messaggi corrotti
          }
        },
      });
      logger.info('✅ Kafka consumer running');
    } catch (error) {
      logger.warn('⚠️  Could not subscribe to Kafka topics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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
    logger.error('Error disconnecting from Kafka', { error });
  }
}

export { kafka, producer, consumer };
