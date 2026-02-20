import express from 'express';
import client from 'prom-client';
import { config } from '../config';
import { logger } from './logger';

const register = new client.Registry();
register.clear();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'feed_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'statusCode'],
  buckets: [0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'feed_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'statusCode'],
  registers: [register],
});

const feedFanOutTotal = new client.Counter({
  name: 'feed_fan_out_total',
  help: 'Total feed fan-out operations',
  labelNames: ['type'],
  registers: [register],
});

const feedSizeGauge = new client.Gauge({
  name: 'feed_size_entries',
  help: 'Number of entries in a user feed (sampled)',
  registers: [register],
});

const kafkaMessagesProcessed = new client.Counter({
  name: 'feed_kafka_messages_processed_total',
  help: 'Total Kafka messages processed',
  labelNames: ['topic', 'event_type', 'status'],
  registers: [register],
});

class Metrics {
  recordRequestDuration(duration: number, labels: Record<string, string>): void {
    httpRequestDuration.observe(labels, duration / 1000);
  }

  incrementCounter(name: string, labels: Record<string, string> = {}): void {
    switch (name) {
      case 'http_requests_total':
        httpRequestsTotal.inc(labels);
        break;
      case 'feed_fan_out':
        feedFanOutTotal.inc(labels);
        break;
      case 'kafka_message_processed':
        kafkaMessagesProcessed.inc(labels);
        break;
      default:
        logger.debug('Unknown metric', { name });
    }
  }

  setFeedSize(size: number): void {
    feedSizeGauge.set(size);
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
    logger.info(`📊 Metrics on port ${config.METRICS.PORT}`);
  });
}

export default metrics;
