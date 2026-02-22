/**
 * Kafka Post Event Consumer
 * Gestisce: post_created → indexPost, post_updated → updatePost, post_deleted → deletePost
 */

import { ElasticsearchService } from '../../services/elasticsearch.service';
import { TrendingService } from '../../services/trending.service';
import { IndexerService } from '../../services/indexer.service';
import { logger } from '../../utils/logger';
import {
  PostEvent,
  PostCreatedEvent,
  PostUpdatedEvent,
  PostDeletedEvent,
} from '../../types';

export class PostEventHandler {
  private readonly indexerService: IndexerService;

  constructor() {
    const esService = new ElasticsearchService();
    const trendingService = new TrendingService();
    this.indexerService = new IndexerService(esService, trendingService);
  }

  async handle(event: PostEvent): Promise<void> {
    logger.debug('Handling post event', { type: event.type, entityId: event.entityId });

    switch (event.type) {
      case 'post_created':
        await this.handlePostCreated(event as PostCreatedEvent);
        break;
      case 'post_updated':
        await this.handlePostUpdated(event as PostUpdatedEvent);
        break;
      case 'post_deleted':
        await this.handlePostDeleted(event as PostDeletedEvent);
        break;
      default:
        logger.warn('Unknown post event type', { type: (event as any).type });
    }
  }

  private async handlePostCreated(event: PostCreatedEvent): Promise<void> {
    try {
      await this.indexerService.indexPost(event);
      logger.info('Post indexed from Kafka', { postId: event.entityId });
    } catch (error) {
      logger.error('Failed to index post from Kafka event', { event, error });
    }
  }

  private async handlePostUpdated(event: PostUpdatedEvent): Promise<void> {
    try {
      await this.indexerService.updatePost(event);
      logger.info('Post updated in index from Kafka', { postId: event.entityId });
    } catch (error) {
      logger.error('Failed to update post in index from Kafka event', { event, error });
    }
  }

  private async handlePostDeleted(event: PostDeletedEvent): Promise<void> {
    try {
      await this.indexerService.deletePost(event.entityId);
      logger.info('Post deleted from index from Kafka', { postId: event.entityId });
    } catch (error) {
      logger.error('Failed to delete post from index from Kafka event', { event, error });
    }
  }
}
