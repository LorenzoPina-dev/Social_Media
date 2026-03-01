/**
 * User Kafka Producer
 * Publishes user-related events to Kafka
 */

import { getKafkaProducer } from '../../config/kafka';
import { logger } from '../../utils/logger';

export class UserProducer {
  private getProducer() {
    try {
      return getKafkaProducer();
    } catch (error) {
      logger.warn('Kafka producer not available', { error });
      return null;
    }
  }

  async publishUserCreated(data: {
    userId: string;
    username: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
    verified?: boolean;
    timestamp: Date;
  }): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'user_events',
        messages: [{ key: data.userId, value: JSON.stringify({ type: 'user_created', ...data }) }],
      });
      logger.info('Published user_created event', { userId: data.userId });
    } catch (error) {
      logger.error('Failed to publish user_created event', { error });
    }
  }

  async publishUserUpdated(data: {
    userId: string;
    username?: string;
    display_name?: string;
    avatar_url?: string | null;
    bio?: string;
    verified?: boolean;
    timestamp: Date;
  }): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'user_events',
        messages: [{ key: data.userId, value: JSON.stringify({ type: 'user_updated', ...data }) }],
      });
    } catch (error) {
      logger.error('Failed to publish user_updated event', { error });
    }
  }

  async publishUserDeletionRequested(data: any): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'user_events',
        messages: [{ key: data.userId, value: JSON.stringify({ type: 'user_deletion_requested', ...data }) }],
      });
    } catch (error) {
      logger.error('Failed to publish event', { error });
    }
  }

  async publishUserDeleted(data: any): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'user_events',
        messages: [{ key: data.userId, value: JSON.stringify({ type: 'user_deleted', ...data }) }],
      });
    } catch (error) {
      logger.error('Failed to publish event', { error });
    }
  }

  async publishUserFollowed(data: any): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'user_events',
        messages: [{ key: data.followerId, value: JSON.stringify({ type: 'user_followed', ...data }) }],
      });
    } catch (error) {
      logger.error('Failed to publish event', { error });
    }
  }

  async publishMessageSent(data: {
    userId: string;
    recipientId: string;
    conversationId: string;
    messageId: string;
    content: string;
    timestamp: string;
  }): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;

    try {
      await producer.send({
        topic: 'user_events',
        messages: [
          {
            key: data.userId,
            value: JSON.stringify({
              type: 'message_sent',
              entityId: data.conversationId,
              userId: data.userId,
              timestamp: data.timestamp,
              payload: {
                recipientId: data.recipientId,
                conversationId: data.conversationId,
                messageId: data.messageId,
                content: data.content,
              },
            }),
          },
        ],
      });
    } catch (error) {
      logger.error('Failed to publish message_sent event', { error });
    }
  }

  async publishUserUnfollowed(data: any): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'user_events',
        messages: [{ key: data.followerId, value: JSON.stringify({ type: 'user_unfollowed', ...data }) }],
      });
    } catch (error) {
      logger.error('Failed to publish event', { error });
    }
  }

  async publishDataExported(data: any): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'user_events',
        messages: [{ key: data.userId, value: JSON.stringify({ type: 'data_exported', ...data }) }],
      });
    } catch (error) {
      logger.error('Failed to publish event', { error });
    }
  }

  async publishDeletionCancelled(data: any): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'user_events',
        messages: [{ key: data.userId, value: JSON.stringify({ type: 'deletion_cancelled', ...data }) }],
      });
    } catch (error) {
      logger.error('Failed to publish event', { error });
    }
  }

  async publishUserPermanentlyDeleted(data: any): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'user_events',
        messages: [{ key: data.userId, value: JSON.stringify({ type: 'user_permanently_deleted', ...data }) }],
      });
    } catch (error) {
      logger.error('Failed to publish event', { error });
    }
  }

  async publishUserAnonymized(data: any): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'user_events',
        messages: [{ key: data.userId, value: JSON.stringify({ type: 'user_anonymized', ...data }) }],
      });
    } catch (error) {
      logger.error('Failed to publish event', { error });
    }
  }
}

export default UserProducer;
