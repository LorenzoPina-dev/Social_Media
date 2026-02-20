/**
 * Metrics Utility
 * Prometheus metrics collection
 */

import express from 'express';
import client from 'prom-client';
import { config } from '../config';
import { logger } from './logger';

// Create registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'statusCode'],
  buckets: [0.1, 0.5, 1, 2, 5],
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

const authLoginAttempts = new client.Counter({
  name: 'auth_login_attempts_total',
  help: 'Total number of login attempts',
  labelNames: ['status'],
  registers: [register],
});

const authRegistrations = new client.Counter({
  name: 'auth_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['status'],
  registers: [register],
});

const authTokenRefreshes = new client.Counter({
  name: 'auth_token_refreshes_total',
  help: 'Total number of token refreshes',
  labelNames: ['status'],
  registers: [register],
});

const activeSessions = new client.Gauge({
  name: 'auth_active_sessions',
  help: 'Number of active sessions',
  registers: [register],
});

/**
 * Metrics utility class
 */
class Metrics {
  /**
   * Record HTTP request duration
   */
  recordRequestDuration(
    _: string,
    duration: number,
    labels: { method?: string; path?: string; statusCode?: string } = {}
  ): void {
    httpRequestDuration.observe(labels, duration / 1000);
  }

  /**
   * Increment counter
   */
  incrementCounter(
    metric: string,
    labels: { method?: string; path?: string; statusCode?: string; status?: string } = {}
  ): void {
    switch (metric) {
      case 'http_requests_total':
        httpRequestsTotal.inc(labels);
        break;
      case 'http_errors_total':
        httpErrorsTotal.inc(labels);
        break;
      case 'auth_login_success':
        authLoginAttempts.inc({ status: 'success' });
        break;
      case 'auth_login_failed':
        authLoginAttempts.inc({ status: 'failed' });
        break;
      case 'auth_login_error':
        authLoginAttempts.inc({ status: 'error' });
        break;
      case 'auth_registration_success':
        authRegistrations.inc({ status: 'success' });
        break;
      case 'auth_registration_failed':
        authRegistrations.inc({ status: 'failed' });
        break;
      case 'auth_token_refresh_success':
        authTokenRefreshes.inc({ status: 'success' });
        break;
      case 'auth_token_refresh_failed':
        authTokenRefreshes.inc({ status: 'failed' });
        break;
      case 'auth_logout_success':
        // No specific metric for logout success
        break;
      case 'auth_logout_all_success':
        // No specific metric for logout all success
        break;
      default:
        logger.warn('Unknown metric', { metric });
    }
  }

  /**
   * Set gauge value
   */
  setGaugeValue(metric: string, value: number): void {
    switch (metric) {
      case 'active_sessions':
        activeSessions.set(value);
        break;
      default:
        logger.warn('Unknown gauge metric', { metric });
    }
  }

  /**
   * Get metrics for Prometheus
   */
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }
}

export const metrics = new Metrics();

/**
 * Start metrics server
 */
export function startMetricsServer(): void {
  const app = express();

  app.get(config.METRICS.PATH, async (_, res) => {
    try {
      res.set('Content-Type', register.contentType);
      const metricsData = await metrics.getMetrics();
      res.end(metricsData);
    } catch (error) {
      res.status(500).end(error);
    }
  });

  app.listen(config.METRICS.PORT, () => {
    logger.info(`📊 Metrics server listening on port ${config.METRICS.PORT}`);
    logger.info(`📈 Metrics available at http://localhost:${config.METRICS.PORT}${config.METRICS.PATH}`);
  });
}

export default metrics;


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