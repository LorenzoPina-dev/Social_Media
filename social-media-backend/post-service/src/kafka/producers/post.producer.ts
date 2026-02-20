/**
 * Post Kafka Producer — topic: post_events
 */

import { getKafkaProducer } from '../../config/kafka';
import { logger } from '../../utils/logger';
import { Post, PostCreatedEvent, PostUpdatedEvent, PostDeletedEvent, PostScheduledEvent } from '../../types';

export class PostProducer {
  private getProducer() {
    try {
      return getKafkaProducer();
    } catch {
      logger.warn('Kafka producer not available');
      return null;
    }
  }

  private async publish(key: string, payload: unknown): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'post_events',
        messages: [{ key, value: JSON.stringify(payload) }],
      });
    } catch (error) {
      logger.error('Failed to publish Kafka event', { error, payload });
    }
  }

  async publishPostCreated(post: Post, hashtags: string[]): Promise<void> {
    const event: PostCreatedEvent = {
      type: 'post_created',
      entityId: post.id,
      userId: post.user_id,
      timestamp: new Date().toISOString(),
      payload: {
        content: post.content,
        hashtags,
        visibility: post.visibility,
        moderation_status: post.moderation_status,
      },
    };
    await this.publish(post.user_id, event);
    logger.info('Published post_created', { postId: post.id });
  }

  async publishPostUpdated(post: Post): Promise<void> {
    const event: PostUpdatedEvent = {
      type: 'post_updated',
      entityId: post.id,
      userId: post.user_id,
      timestamp: new Date().toISOString(),
      payload: { content: post.content, visibility: post.visibility },
    };
    await this.publish(post.user_id, event);
  }

  async publishPostDeleted(postId: string, userId: string): Promise<void> {
    const event: PostDeletedEvent = {
      type: 'post_deleted',
      entityId: postId,
      userId,
      timestamp: new Date().toISOString(),
    };
    await this.publish(userId, event);
    logger.info('Published post_deleted', { postId });
  }

  async publishPostScheduled(post: Post, scheduledAt: Date): Promise<void> {
    const event: PostScheduledEvent = {
      type: 'post_scheduled',
      entityId: post.id,
      userId: post.user_id,
      timestamp: new Date().toISOString(),
      payload: { scheduled_at: scheduledAt.toISOString() },
    };
    await this.publish(post.user_id, event);
    logger.info('Published post_scheduled', { postId: post.id, scheduledAt });
  }
}

export default PostProducer;
