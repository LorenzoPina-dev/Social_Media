/**
 * Metrics Utility
 * Prometheus metrics collection
 */

import express from 'express';
import client from 'prom-client';
import { config } from '../config';
import { logger } from './logger';

// ── Registry isolato ──────────────────────────────────────────────────────────
// Usiamo un registry dedicato (non il default globale) per evitare conflitti
// quando il modulo viene richiesto più volte nello stesso processo.
// register.clear() garantisce che su ogni re-require (ts-node watch, Jest)
// le metriche vengano ri-registrate su un registry pulito senza errori
// "A metric with that name has already been registered".
const register = new client.Registry();
register.clear();
client.collectDefaultMetrics({ register });

// ── Custom metrics ────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metrics utility
 */
class Metrics {
  /**
   * Record HTTP request duration (duration in ms)
   */
  recordRequestDuration(
    _: string,
    duration: number,
    labels: { method?: string; path?: string; statusCode?: string } = {}
  ): void {
    httpRequestDuration.observe(labels, duration / 1000);
  }

  /**
   * Increment a named counter
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
      case 'auth_logout_all_success':
      case 'mfa_setup_initiated':
      case 'mfa_enabled_success':
      case 'mfa_verification_failed':
      case 'mfa_login_success':
      case 'mfa_login_failed':
      case 'mfa_backup_code_used':
      case 'mfa_disabled':
      case 'mfa_backup_codes_regenerated':
        // Counters acknowledged but not yet exposed as separate metrics
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
   * Get metrics in Prometheus text format
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}

export const metrics = new Metrics();

/**
 * Start standalone metrics HTTP server on METRICS_PORT
 */
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
    logger.info(`📈 Metrics at http://localhost:${config.METRICS.PORT}${config.METRICS.PATH}`);
  });
}

export default metrics;
