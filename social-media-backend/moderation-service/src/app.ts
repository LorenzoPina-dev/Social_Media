import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import 'express-async-errors';

import { config } from './config';
import { apiRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { router } from './routes';
import { register } from './utils/metrics';
import { logger } from './utils/logger';

export function createApp(): express.Application {
  const app = express();

  // Security
  app.use(helmet());
  const corsOptions = {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));
  app.disable('x-powered-by');

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  // Health endpoints (no auth, no rate limit)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'moderation-service', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', async (_req, res) => {
    try {
      // Basic readiness check
      res.json({ status: 'ready', service: 'moderation-service' });
    } catch (err) {
      logger.error('Readiness check failed', { error: err });
      res.status(503).json({ status: 'not ready' });
    }
  });

  // Prometheus metrics
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // Rate limiting
  app.use('/api', apiRateLimiter);

  // Routes
  app.use('/api/v1', router);

  // 404
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
