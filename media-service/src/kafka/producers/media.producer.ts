/**
 * Kafka Producer — media-service
 * Publishes media_events to Kafka
 */

import { getKafkaProducer } from '../../config/kafka';
import { logger } from '../../utils/logger';

export class MediaProducer {
  private getProducer() {
    try {
      return getKafkaProducer();
    } catch {
      logger.warn('Kafka producer not available — skipping event publish');
      return null;
    }
  }

  async publishMediaUploaded(data: {
    mediaId: string;
    userId: string;
    content_type: string;
    size_bytes: number;
    storage_key: string;
  }): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'media_events',
        messages: [{
          key: data.mediaId,
          value: JSON.stringify({
            type: 'media_uploaded',
            entityId: data.mediaId,
            userId: data.userId,
            timestamp: new Date().toISOString(),
            payload: {
              content_type: data.content_type,
              size_bytes: data.size_bytes,
              storage_key: data.storage_key,
            },
          }),
        }],
      });
      logger.info('Published media_uploaded event', { mediaId: data.mediaId });
    } catch (error) {
      logger.error('Failed to publish media_uploaded event', { error });
    }
  }

  async publishMediaProcessed(data: {
    mediaId: string;
    userId: string;
    cdn_url: string;
    thumbnail_url: string | null;
    blurhash: string | null;
    width: number | null;
    height: number | null;
    duration_seconds: number | null;
  }): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'media_events',
        messages: [{
          key: data.mediaId,
          value: JSON.stringify({
            type: 'media_processed',
            entityId: data.mediaId,
            userId: data.userId,
            timestamp: new Date().toISOString(),
            payload: {
              cdn_url: data.cdn_url,
              thumbnail_url: data.thumbnail_url,
              blurhash: data.blurhash,
              width: data.width,
              height: data.height,
              duration_seconds: data.duration_seconds,
            },
          }),
        }],
      });
      logger.info('Published media_processed event', { mediaId: data.mediaId });
    } catch (error) {
      logger.error('Failed to publish media_processed event', { error });
    }
  }

  async publishMediaDeleted(data: { mediaId: string; userId: string }): Promise<void> {
    const producer = this.getProducer();
    if (!producer) return;
    try {
      await producer.send({
        topic: 'media_events',
        messages: [{
          key: data.mediaId,
          value: JSON.stringify({
            type: 'media_deleted',
            entityId: data.mediaId,
            userId: data.userId,
            timestamp: new Date().toISOString(),
            payload: {},
          }),
        }],
      });
      logger.info('Published media_deleted event', { mediaId: data.mediaId });
    } catch (error) {
      logger.error('Failed to publish media_deleted event', { error });
    }
  }
}
