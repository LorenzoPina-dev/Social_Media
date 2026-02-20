/**
 * Prometheus Metrics
 */

import express from 'express';
import client from 'prom-client';
import { config } from '../config';
import { logger } from './logger';

const register = new client.Registry();
register.clear();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'statusCode'],
  buckets: [0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'statusCode'],
  registers: [register],
});

const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'path', 'statusCode'],
  registers: [register],
});

const likesTotal = new client.Counter({
  name: 'interaction_likes_total',
  help: 'Total likes created',
  labelNames: ['action', 'target_type'],
  registers: [register],
});

const commentsTotal = new client.Counter({
  name: 'interaction_comments_total',
  help: 'Total comments created',
  labelNames: ['action'],
  registers: [register],
});

const sharesTotal = new client.Counter({
  name: 'interaction_shares_total',
  help: 'Total shares created',
  registers: [register],
});

class Metrics {
  recordRequestDuration(
    _name: string,
    duration: number,
    labels: { method?: string; path?: string; statusCode?: string } = {}
  ): void {
    httpRequestDuration.observe(labels, duration / 1000);
  }

  incrementCounter(
    metric: string,
    labels: { method?: string; path?: string; statusCode?: string; action?: string; target_type?: string } = {}
  ): void {
    switch (metric) {
      case 'http_requests_total':      httpRequestsTotal.inc(labels); break;
      case 'http_errors_total':        httpErrorsTotal.inc(labels); break;
      case 'like_created':             likesTotal.inc({ action: 'created', target_type: labels.target_type || 'unknown' }); break;
      case 'like_deleted':             likesTotal.inc({ action: 'deleted', target_type: labels.target_type || 'unknown' }); break;
      case 'comment_created':          commentsTotal.inc({ action: 'created' }); break;
      case 'comment_deleted':          commentsTotal.inc({ action: 'deleted' }); break;
      case 'share_created':            sharesTotal.inc(); break;
      default: logger.warn('Unknown metric', { metric });
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
    } catch (error) {
      res.status(500).end(error);
    }
  });
  app.listen(config.METRICS.PORT, () => {
    logger.info(`📊 Metrics server listening on port ${config.METRICS.PORT}`);
  });
}

export default metrics;
