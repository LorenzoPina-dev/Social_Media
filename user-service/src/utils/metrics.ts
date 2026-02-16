/**
 * Prometheus Metrics
 * Performance monitoring and metrics collection
 */

import client from 'prom-client';
import express from 'express';
import { config } from '../config';
import { logger } from './logger';

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({
  register,
  prefix: 'user_service_',
});

// Custom metrics
export const userMetrics = {
  // HTTP metrics
  requestDuration: new client.Histogram({
    name: 'user_service_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'endpoint', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [register],
  }),

  requestTotal: new client.Counter({
    name: 'user_service_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'endpoint', 'status'],
    registers: [register],
  }),

  // User metrics
  userCreated: new client.Counter({
    name: 'user_service_users_created_total',
    help: 'Total number of users created',
    registers: [register],
  }),

  userUpdated: new client.Counter({
    name: 'user_service_users_updated_total',
    help: 'Total number of users updated',
    registers: [register],
  }),

  userDeleted: new client.Counter({
    name: 'user_service_users_deleted_total',
    help: 'Total number of users deleted',
    registers: [register],
  }),

  userRetrieved: new client.Counter({
    name: 'user_service_users_retrieved_total',
    help: 'Total number of user retrievals',
    registers: [register],
  }),

  userSearched: new client.Counter({
    name: 'user_service_users_searched_total',
    help: 'Total number of user searches',
    registers: [register],
  }),

  // Follower metrics
  userFollowed: new client.Counter({
    name: 'user_service_users_followed_total',
    help: 'Total number of follow actions',
    registers: [register],
  }),

  userUnfollowed: new client.Counter({
    name: 'user_service_users_unfollowed_total',
    help: 'Total number of unfollow actions',
    registers: [register],
  }),

  // Cache metrics
  cacheHit: new client.Counter({
    name: 'user_service_cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_type'],
    registers: [register],
  }),

  cacheMiss: new client.Counter({
    name: 'user_service_cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_type'],
    registers: [register],
  }),

  // Database metrics
  dbQueryDuration: new client.Histogram({
    name: 'user_service_db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1],
    registers: [register],
  }),
};

/**
 * Start metrics server
 */
export function startMetricsServer(): void {
  const app = express();

  app.get(config.METRICS.PATH, async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      res.status(500).end(error);
    }
  });

  app.listen(config.METRICS.PORT, () => {
    logger.info(`📊 Metrics server listening on port ${config.METRICS.PORT}`);
    logger.info(`📈 Metrics available at http://localhost:${config.METRICS.PORT}${config.METRICS.PATH}`);
  });
}

export { register };
export default userMetrics;
