/**
 * ElasticsearchService — wrapper con retry, logging e metriche
 * Tutte le chiamate ES passano da qui: nessun servizio chiama il client direttamente.
 */

import { Client } from '@elastic/elasticsearch';
import type { Sort } from '@elastic/elasticsearch/lib/api/types';
import { getElasticsearchClient } from '../config/elasticsearch';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { ElasticsearchError } from '../types';

export class ElasticsearchService {
  private get client(): Client {
    return getElasticsearchClient();
  }

  // ── Index ────────────────────────────────────────────────────────────────

  async indexDocument(index: string, id: string, document: Record<string, unknown>): Promise<void> {
    try {
      await this.client.index({ index, id, document, refresh: 'wait_for' });
      metrics.recordIndexingOperation('index', index, 'success');
      logger.debug('Document indexed', { index, id });
    } catch (error) {
      metrics.recordIndexingOperation('index', index, 'error');
      logger.error('Failed to index document', { index, id, error });
      throw new ElasticsearchError(`Failed to index document in ${index}: ${(error as Error).message}`);
    }
  }

  // ── Update ───────────────────────────────────────────────────────────────

  async updateDocument(
    index: string,
    id: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.client.update({ index, id, doc: fields, retry_on_conflict: 3 });
      metrics.recordIndexingOperation('update', index, 'success');
      logger.debug('Document updated', { index, id });
    } catch (error: any) {
      // 404 = documento non esiste, ignoriamo silenziosamente
      if (error?.statusCode === 404 || error?.meta?.statusCode === 404) {
        logger.warn('Document not found for update (skip)', { index, id });
        return;
      }
      metrics.recordIndexingOperation('update', index, 'error');
      logger.error('Failed to update document', { index, id, error });
      throw new ElasticsearchError(`Failed to update document in ${index}: ${(error as Error).message}`);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async deleteDocument(index: string, id: string): Promise<void> {
    try {
      await this.client.delete({ index, id, refresh: 'wait_for' });
      metrics.recordIndexingOperation('delete', index, 'success');
      logger.debug('Document deleted', { index, id });
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.meta?.statusCode === 404) {
        logger.warn('Document not found for delete (skip)', { index, id });
        return;
      }
      metrics.recordIndexingOperation('delete', index, 'error');
      logger.error('Failed to delete document', { index, id, error });
      throw new ElasticsearchError(`Failed to delete document from ${index}: ${(error as Error).message}`);
    }
  }

  // ── Search ───────────────────────────────────────────────────────────────

  async search<T = Record<string, unknown>>(
    index: string,
    query: Record<string, unknown>,
    options: { from?: number; size?: number; sort?: Sort } = {},
  ): Promise<{ hits: T[]; total: number; took: number }> {
    try {
      const response = await this.client.search({
        index,
        from: options.from ?? 0,
        size: options.size ?? 20,
        sort: options.sort,
        query: query as any,
      });

      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : (response.hits.total?.value ?? 0);

      const hits = response.hits.hits.map((h) => ({
        ...(h._source as T),
        score: h._score ?? 0,
      }));

      return { hits, total, took: response.took };
    } catch (error) {
      logger.error('Search failed', { index, error });
      throw new ElasticsearchError(`Search failed on ${index}: ${(error as Error).message}`);
    }
  }

  // ── Suggest (completion) ─────────────────────────────────────────────────

  async suggest(
    index: string,
    field: string,
    prefix: string,
    size: number = 10,
  ): Promise<string[]> {
    try {
      const response = await this.client.search({
        index,
        suggest: {
          autocomplete: {
            prefix,
            completion: { field, size, skip_duplicates: true },
          },
        },
        _source: false,
      } as any);

      const suggestions: string[] = [];
      const suggest = (response as any).suggest?.autocomplete ?? [];
      for (const bucket of suggest) {
        for (const option of bucket.options ?? []) {
          suggestions.push(option.text as string);
        }
      }
      return suggestions;
    } catch (error) {
      logger.error('Suggest failed', { index, field, error });
      throw new ElasticsearchError(`Suggest failed: ${(error as Error).message}`);
    }
  }

  // ── Health ───────────────────────────────────────────────────────────────

  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.client.cluster.health({});
      return health.status !== 'red';
    } catch {
      return false;
    }
  }
}
