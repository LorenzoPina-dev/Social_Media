/**
 * Kafka Configuration — feed-service
 *
 * The feed-service is a pure consumer: it reacts to events from
 * post_events, interaction_events, and user_events to maintain Redis feeds.
 * It never produces Kafka messages.
 */

import { Kafka, Consumer, logLevel } from 'kafkajs';
import { config } from './index';
import { logger } from '../utils/logger';

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

/**
 * Initialize the Kafka consumer and wire up topic handlers.
 * The actual message-routing logic lives in the consumer modules.
 */
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
      topics: ['post_events', 'interaction_events', 'user_events'],
      fromBeginning: false,
    });

    logger.info('✅ Subscribed to Kafka topics: post_events, interaction_events, user_events');

    // Lazy-import consumer handlers to avoid circular deps at boot time
    const { handlePostEvent } = await import('../kafka/consumers/post.consumer');
    const { handleInteractionEvent } = await import('../kafka/consumers/interaction.consumer');
    const { handleUserEvent } = await import('../kafka/consumers/user.consumer');

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const raw = message.value?.toString();
          if (!raw) return;

          const event = JSON.parse(raw);

          switch (topic) {
            case 'post_events':
              await handlePostEvent(event);
              break;
            case 'interaction_events':
              await handleInteractionEvent(event);
              break;
            case 'user_events':
              await handleUserEvent(event);
              break;
            default:
              logger.warn('Unknown Kafka topic', { topic });
          }
        } catch (err) {
          logger.error('Error processing Kafka message', { topic, err });
        }
      },
    });
  } catch (error) {
    logger.warn('⚠️  Kafka connection failed — service will continue without Kafka', {
      error: error instanceof Error ? error.message : error,
    });
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
