/**
 * Prometheus Metrics — Post Service
 */

import express from 'express';
import client from 'prom-client';
import { config } from '../config';
import { logger } from './logger';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const postMetrics = {
  httpRequestDuration: new client.Histogram({
    name: 'post_service_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'endpoint', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [register],
  }),

  httpRequestsTotal: new client.Counter({
    name: 'post_service_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'endpoint', 'status'],
    registers: [register],
  }),

  postsCreated: new client.Counter({
    name: 'post_service_posts_created_total',
    help: 'Total posts created',
    registers: [register],
  }),

  postsUpdated: new client.Counter({
    name: 'post_service_posts_updated_total',
    help: 'Total posts updated',
    registers: [register],
  }),

  postsDeleted: new client.Counter({
    name: 'post_service_posts_deleted_total',
    help: 'Total posts deleted',
    registers: [register],
  }),

  scheduledPostsPublished: new client.Counter({
    name: 'post_service_scheduled_posts_published_total',
    help: 'Total scheduled posts published',
    registers: [register],
  }),

  cacheHit: new client.Counter({
    name: 'post_service_cache_hits_total',
    help: 'Cache hits',
    labelNames: ['cache_type'],
    registers: [register],
  }),

  cacheMiss: new client.Counter({
    name: 'post_service_cache_misses_total',
    help: 'Cache misses',
    labelNames: ['cache_type'],
    registers: [register],
  }),
};

export function startMetricsServer(): void {
  const app = express();

  app.get(config.METRICS.PATH, async (_, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      res.status(500).end(error);
    }
  });

  app.listen(config.METRICS.PORT, () => {
    logger.info(`📊 Metrics server listening on port ${config.METRICS.PORT}`);
  });
}

export default postMetrics;
