/**
 * Routes Index — wiring controller + services + routes
 */

import { Application } from 'express';
import { setupSearchRoutes } from './search.routes';
import { SearchController } from '../controllers/search.controller';
import { SearchService } from '../services/search.service';
import { AutocompleteService } from '../services/autocomplete.service';
import { TrendingService } from '../services/trending.service';
import { ElasticsearchService } from '../services/elasticsearch.service';
import { IndexerService } from '../services/indexer.service';
import { logger } from '../utils/logger';

// Esporto le istanze singleton per riuso (es. dai Kafka consumers)
let indexerService: IndexerService | null = null;

export function getIndexerService(): IndexerService {
  if (!indexerService) throw new Error('IndexerService not initialized yet');
  return indexerService;
}

export function setupRoutes(app: Application): void {
  // Services
  const esService         = new ElasticsearchService();
  const trendingService   = new TrendingService();
  const autocompleteService = new AutocompleteService(esService);
  const searchService     = new SearchService(esService);
  indexerService          = new IndexerService(esService, trendingService);

  // Controller
  const searchController = new SearchController(
    searchService,
    autocompleteService,
    trendingService,
  );

  // Routes
  app.use('/api/v1/search', setupSearchRoutes(searchController));

  // 404 catch-all
  app.use('*', (_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found', code: 'NOT_FOUND' });
  });

  logger.info('Search routes configured');
}

// Export service instances for use in Kafka consumers
export { ElasticsearchService, TrendingService, AutocompleteService, IndexerService };
