/**
 * Kafka Configuration — notification-service
 *
 * ARCHITETTURA:
 * Un singolo Consumer instance sottoscrive tutti i topic rilevanti,
 * chiama consumer.run() UNA SOLA VOLTA e dispatcha i messaggi
 * verso handler registrati per topic.
 *
 * ERRORE CORRETTO: in KafkaJS consumer.run() può essere chiamato
 * solo una volta per istanza. Avere 4 consumer class che chiamano
 * ciascuna subscribe()+run() sulla stessa istanza fa sì che solo
 * il primo run() sia attivo. Questo pattern centralizzato è la soluzione corretta.
 */

import { Kafka, Producer, Consumer, logLevel } from 'kafkajs';
import { config } from './index';
import { logger } from '../utils/logger';

let kafka: Kafka | null = null;
let producer: Producer | null = null;
let consumer: Consumer | null = null;

// Map topic → handler function registrato dall'app
const topicHandlers = new Map<string, (event: unknown) => Promise<void>>();

/**
 * Registra un handler per un topic. Chiamato da app.ts dopo
 * la connessione Kafka per collegare ogni consumer class al suo topic.
 */
export function registerTopicHandler(
  topic: string,
  handler: (event: unknown) => Promise<void>,
): void {
  topicHandlers.set(topic, handler);
  logger.debug('Kafka topic handler registered', { topic });
}

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

    // Producer (per future notifiche via Kafka, se necessario)
    producer = kafkaInstance.producer({ allowAutoTopicCreation: true });
    await producer.connect();
    logger.info('✅ Kafka producer connected');

    // Single consumer instance per tutto il servizio
    consumer = kafkaInstance.consumer({
      groupId: config.KAFKA_GROUP_ID,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      allowAutoTopicCreation: true,
    });
    await consumer.connect();
    logger.info('✅ Kafka consumer connected');

    // Sottoscrizione a tutti i topic in un unico consumer.subscribe()
    // (deve avvenire PRIMA di consumer.run())
    await consumer.subscribe({
      topics: ['interaction_events', 'user_events', 'post_events', 'moderation_events'],
      fromBeginning: false,
    });
    logger.info('✅ Subscribed to: interaction_events, user_events, post_events, moderation_events');

    // Unico consumer.run() — dispatcha ai handler registrati
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const raw = message.value?.toString();
        if (!raw) return;

        try {
          const event = JSON.parse(raw);
          const handler = topicHandlers.get(topic);

          if (handler) {
            await handler(event);
          } else {
            logger.warn('No handler registered for topic', { topic, eventType: event.type });
          }
        } catch (err) {
          logger.error('Failed to process Kafka message', {
            topic,
            partition,
            offset: message.offset,
            error: err,
          });
          // Non rilanciare: evita loop infiniti su messaggi corrotti
        }
      },
    });

    logger.info('✅ Kafka consumer running (centralized dispatcher)');
  } catch (error) {
    logger.warn('⚠️  Kafka connection failed, continuing without Kafka', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Non-blocking: il servizio parte anche senza Kafka
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
    topicHandlers.clear();
    logger.info('Kafka disconnected');
  } catch (error) {
    logger.error('Error disconnecting Kafka', { error });
  }
}

export { kafka, producer, consumer };
