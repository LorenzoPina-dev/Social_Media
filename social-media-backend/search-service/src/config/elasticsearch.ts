/**
 * Elasticsearch Client Configuration
 */

import { Client } from '@elastic/elasticsearch';
import { config } from './index';
import { logger } from '../utils/logger';

let esClient: Client | null = null;

export function createElasticsearchClient(): Client {
  if (esClient) return esClient;

  esClient = new Client({
    node: config.ELASTICSEARCH_URL,
    requestTimeout: 10000,
    maxRetries: 3,
  });

  return esClient;
}

export async function connectElasticsearch(): Promise<Client> {
  const client = createElasticsearchClient();
  try {
    const health = await client.cluster.health({});
    logger.info('✅ Elasticsearch connected', { status: health.status });
    return client;
  } catch (error) {
    logger.error('❌ Failed to connect to Elasticsearch', { error });
    throw error;
  }
}

export function getElasticsearchClient(): Client {
  if (!esClient) {
    throw new Error('Elasticsearch not initialized. Call connectElasticsearch() first.');
  }
  return esClient;
}

export async function disconnectElasticsearch(): Promise<void> {
  if (esClient) {
    await esClient.close();
    esClient = null;
    logger.info('Elasticsearch disconnected');
  }
}

export { esClient };
