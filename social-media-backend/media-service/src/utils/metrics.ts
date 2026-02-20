import express from 'express';
import client from 'prom-client';
import { config } from '../config';
import { logger } from './logger';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const mediaMetrics = {
  requestDuration: new client.Histogram({
    name: 'media_service_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'endpoint', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [register],
  }),
  uploadsTotal: new client.Counter({
    name: 'media_service_uploads_total',
    help: 'Total number of file uploads',
    labelNames: ['status', 'content_type'],
    registers: [register],
  }),
  processingJobsTotal: new client.Counter({
    name: 'media_service_processing_jobs_total',
    help: 'Total number of processing jobs',
    labelNames: ['job_type', 'status'],
    registers: [register],
  }),
  storageBytesTotal: new client.Gauge({
    name: 'media_service_storage_bytes',
    help: 'Total bytes stored',
    registers: [register],
  }),
};

export function startMetricsServer(): void {
  const app = express();
  app.get(config.METRICS.PATH, async (_, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.status(500).end(err);
    }
  });
  app.listen(config.METRICS.PORT, () => {
    logger.info(`📊 Metrics server listening on port ${config.METRICS.PORT}`);
  });
}
