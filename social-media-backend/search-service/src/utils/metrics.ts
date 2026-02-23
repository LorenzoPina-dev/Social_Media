/**
 * Prometheus Metrics — Search Service
 */

import express from 'express';
import client from 'prom-client';
import { config } from '../config';
import { logger } from './logger';

const register = new client.Registry();
register.clear();
client.collectDefaultMetrics({ register });

// ── Custom metrics ────────────────────────────────────────────────────────────

const searchRequestsTotal = new client.Counter({
  name: 'search_requests_total',
  help: 'Total search requests',
  labelNames: ['type', 'status'],
  registers: [register],
});

const searchDurationHistogram = new client.Histogram({
  name: 'search_duration_seconds',
  help: 'Search query duration',
  labelNames: ['type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const indexingOperationsTotal = new client.Counter({
  name: 'indexing_operations_total',
  help: 'Total Elasticsearch indexing operations',
  labelNames: ['operation', 'index', 'status'],
  registers: [register],
});

const cacheHitsTotal = new client.Counter({
  name: 'cache_hits_total',
  help: 'Redis cache hits',
  labelNames: ['key_type'],
  registers: [register],
});

const cacheMissesTotal = new client.Counter({
  name: 'cache_misses_total',
  help: 'Redis cache misses',
  labelNames: ['key_type'],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'statusCode'],
  registers: [register],
});

// ── Metrics helper ────────────────────────────────────────────────────────────

class Metrics {
  recordSearchRequest(type: string, status: 'success' | 'error'): void {
    searchRequestsTotal.inc({ type, status });
  }

  recordSearchDuration(type: string, durationMs: number): void {
    searchDurationHistogram.observe({ type }, durationMs / 1000);
  }

  recordIndexingOperation(
    operation: 'index' | 'update' | 'delete',
    index: string,
    status: 'success' | 'error',
  ): void {
    indexingOperationsTotal.inc({ operation, index, status });
  }

  recordCacheHit(keyType: string): void {
    cacheHitsTotal.inc({ key_type: keyType });
  }

  recordCacheMiss(keyType: string): void {
    cacheMissesTotal.inc({ key_type: keyType });
  }

  recordRequestDuration(_label: string, _durationMs: number): void {
    // Kept for compatibility with requestLogger middleware
  }

  incrementCounter(
    metric: string,
    labels: Record<string, string> = {},
  ): void {
    if (metric === 'http_requests_total') {
      httpRequestsTotal.inc(labels);
    }
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}

export const metrics = new Metrics();

export function startMetricsServer(): void {
  const app = express();
  app.get(config.METRICS.PATH, async (_, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await metrics.getMetrics());
    } catch (err) {
      res.status(500).end(err);
    }
  });
  app.listen(config.METRICS.PORT, () => {
    logger.info(`📊 Metrics on port ${config.METRICS.PORT}${config.METRICS.PATH}`);
  });
}

export default metrics;
