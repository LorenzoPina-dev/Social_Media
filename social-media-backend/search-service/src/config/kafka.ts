/**
 * Kafka Configuration — consumer only (search-service non produce eventi)
 */

import { Kafka, Consumer, logLevel } from 'kafkajs';
import { config } from './index';
import { logger } from '../utils/logger';
import { UserEvent, PostEvent } from '../types';

let kafka: Kafka | null = null;
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

    consumer = kafkaInstance.consumer({
      groupId: config.KAFKA_GROUP_ID,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      allowAutoTopicCreation: true,
    });

    await consumer.connect();
    logger.info('✅ Kafka consumer connected');

    await consumer.subscribe({
      topics: ['user_events', 'post_events'],
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const raw = message.value?.toString();
          if (!raw) return;

          const event = JSON.parse(raw);
          logger.debug('Kafka message received', { topic, type: event.type });

          if (topic === 'user_events') {
            const { UserEventHandler } = await import('../kafka/consumers/user.consumer');
            await new UserEventHandler().handle(event as UserEvent);
          } else if (topic === 'post_events') {
            const { PostEventHandler } = await import('../kafka/consumers/post.consumer');
            await new PostEventHandler().handle(event as PostEvent);
          }
        } catch (err) {
          logger.error('Failed to process Kafka message', { topic, error: err });
        }
      },
    });

    logger.info('✅ Kafka consumer running');
  } catch (error) {
    logger.warn('⚠️  Kafka unavailable, continuing without consumer', { error });
  }
}

export function getKafkaConsumer(): Consumer {
  if (!consumer) throw new Error('Kafka consumer not initialized.');
  return consumer;
}

export async function disconnectKafka(): Promise<void> {
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
    logger.info('Kafka consumer disconnected');
  }
}

export { kafka, consumer };
