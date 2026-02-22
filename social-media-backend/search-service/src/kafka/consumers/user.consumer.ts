/**
 * Kafka User Event Consumer
 * Gestisce: user_registered → indexUser, user_updated → updateUser, user_deleted → deleteUser
 */

import { ElasticsearchService } from '../../services/elasticsearch.service';
import { TrendingService } from '../../services/trending.service';
import { IndexerService } from '../../services/indexer.service';
import { AutocompleteService } from '../../services/autocomplete.service';
import { logger } from '../../utils/logger';
import {
  UserEvent,
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
} from '../../types';

export class UserEventHandler {
  private readonly indexerService: IndexerService;
  private readonly autocompleteService: AutocompleteService;

  constructor() {
    const esService = new ElasticsearchService();
    const trendingService = new TrendingService();
    this.indexerService = new IndexerService(esService, trendingService);
    this.autocompleteService = new AutocompleteService(esService);
  }

  async handle(event: UserEvent): Promise<void> {
    logger.debug('Handling user event', { type: event.type, entityId: event.entityId });

    switch (event.type) {
      case 'user_registered':
        await this.handleUserRegistered(event as UserCreatedEvent);
        break;
      case 'user_updated':
        await this.handleUserUpdated(event as UserUpdatedEvent);
        break;
      case 'user_deleted':
        await this.handleUserDeleted(event as UserDeletedEvent);
        break;
      default:
        logger.warn('Unknown user event type', { type: (event as any).type });
    }
  }

  private async handleUserRegistered(event: UserCreatedEvent): Promise<void> {
    try {
      await this.indexerService.indexUser(event);
      logger.info('User indexed from Kafka', { userId: event.entityId });
    } catch (error) {
      logger.error('Failed to index user from Kafka event', { event, error });
    }
  }

  private async handleUserUpdated(event: UserUpdatedEvent): Promise<void> {
    try {
      await this.indexerService.updateUser(event);

      // Invalida cache autocomplete se username è cambiato
      const { changedFields } = event.payload;
      if (changedFields.includes('username') && event.payload.username) {
        await this.autocompleteService.invalidateCache(event.payload.username);
      }

      logger.info('User updated in index from Kafka', { userId: event.entityId });
    } catch (error) {
      logger.error('Failed to update user in index from Kafka event', { event, error });
    }
  }

  private async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    try {
      await this.indexerService.deleteUser(event.entityId);
      logger.info('User deleted from index from Kafka', { userId: event.entityId });
    } catch (error) {
      logger.error('Failed to delete user from index from Kafka event', { event, error });
    }
  }
}
