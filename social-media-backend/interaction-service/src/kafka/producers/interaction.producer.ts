/**
 * Interaction Producer
 * Publishes interaction events to `interaction_events` Kafka topic
 */

import { getKafkaProducer } from '../../config/kafka';
import { logger } from '../../utils/logger';
import {
  LikeCreatedEvent,
  LikeDeletedEvent,
  CommentCreatedEvent,
  CommentDeletedEvent,
  ShareCreatedEvent,
  InteractionEvent,
} from '../../types';

export class InteractionProducer {
  private readonly topic = 'interaction_events';

  async publishEvent(event: InteractionEvent): Promise<void> {
    try {
      const producer = getKafkaProducer();
      await producer.send({
        topic: this.topic,
        messages: [
          {
            key: event.entityId,
            value: JSON.stringify(event),
            timestamp: new Date().getTime().toString(),
          },
        ],
      });
      logger.debug('Interaction event published', { eventType: event.type, entityId: event.entityId });
    } catch (error) {
      logger.warn('Failed to publish interaction event (Kafka may be unavailable)', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventType: event.type,
      });
      // Non-blocking: don't fail the HTTP request if Kafka is down
    }
  }

  async publishLikeCreated(event: LikeCreatedEvent): Promise<void> {
    await this.publishEvent(event);
  }

  async publishLikeDeleted(event: LikeDeletedEvent): Promise<void> {
    await this.publishEvent(event);
  }

  async publishCommentCreated(event: CommentCreatedEvent): Promise<void> {
    await this.publishEvent(event);
  }

  async publishCommentDeleted(event: CommentDeletedEvent): Promise<void> {
    await this.publishEvent(event);
  }

  async publishShareCreated(event: ShareCreatedEvent): Promise<void> {
    await this.publishEvent(event);
  }
}
