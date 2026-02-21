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

const notificationsCreated = new client.Counter({
  name: 'notifications_created_total',
  help: 'Total notifications created',
  labelNames: ['type'],
  registers: [register],
});

const notificationsSent = new client.Counter({
  name: 'notifications_sent_total',
  help: 'Total notifications dispatched',
  labelNames: ['channel', 'status'],
  registers: [register],
});

const wsConnections = new client.Gauge({
  name: 'websocket_connections_active',
  help: 'Active WebSocket connections',
  registers: [register],
});

class Metrics {
  recordRequestDuration(_: string, duration: number, labels: Record<string, string> = {}): void {
    httpRequestDuration.observe(labels, duration / 1000);
  }

  incrementCounter(metric: string, labels: Record<string, string> = {}): void {
    switch (metric) {
      case 'http_requests_total': httpRequestsTotal.inc(labels); break;
      case 'http_errors_total': httpErrorsTotal.inc(labels); break;
      case 'notification_created': notificationsCreated.inc({ type: labels['type'] || 'unknown' }); break;
      case 'notification_sent': notificationsSent.inc({ channel: labels['channel'] || 'unknown', status: labels['status'] || 'ok' }); break;
      default: logger.warn('Unknown metric', { metric });
    }
  }

  setGaugeValue(metric: string, value: number): void {
    if (metric === 'ws_connections') wsConnections.set(value);
  }

  incGauge(metric: string): void {
    if (metric === 'ws_connections') wsConnections.inc();
  }

  decGauge(metric: string): void {
    if (metric === 'ws_connections') wsConnections.dec();
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
      res.status(500).end(String(error));
    }
  });
  app.listen(config.METRICS.PORT, () => {
    logger.info(`📊 Metrics server on port ${config.METRICS.PORT}`);
  });
}

export default metrics;
