/**
 * Express App Factory — separata da index.ts per testabilità
 */

import 'express-async-errors';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { setupRoutes } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { connectRedis, getRedisClient } from './config/redis';
import { connectElasticsearch, getElasticsearchClient } from './config/elasticsearch';
import { connectKafka } from './config/kafka';
import { setupElasticsearchIndices } from './utils/setupElasticsearch';

export async function createApp(): Promise<Application> {
  const app: Application = express();
  app.set('trust proxy', 1);

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        scriptSrc:  ["'self'"],
        imgSrc:     ["'self'", 'data:', 'https:'],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }));

  const corsOptions = {
    origin: config.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());
  app.use(requestLogger);

  // ── Infrastructure ────────────────────────────────────────────────────────
  logger.info('📦 Connecting to infrastructure...');

  await Promise.all([
    connectRedis(),
    connectElasticsearch(),
  ]);

  // Crea indici ES se non esistono
  await setupElasticsearchIndices(getElasticsearchClient());

  // Kafka — non bloccante
  connectKafka().catch((err) =>
    logger.warn('⚠️  Kafka unavailable, continuing without consumer', { error: err }),
  );

  logger.info('✅ Infrastructure ready');

  // ── Health endpoints ──────────────────────────────────────────────────────

  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: config.SERVICE_NAME,
      version: config.VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (_req, res) => {
    try {
      const redis = getRedisClient();
      const es = getElasticsearchClient();

      await redis.ping();
      const esOk = await es.cluster.health({}).then((h) => h.status !== 'red').catch(() => false);

      if (!esOk) throw new Error('Elasticsearch not healthy');

      res.json({
        status: 'ready',
        checks: { redis: 'ok', elasticsearch: esOk ? 'ok' : 'degraded' },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Readiness check failed', { error });
      res.status(503).json({ status: 'not ready', error: 'Health check failed' });
    }
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  setupRoutes(app);

  // ── Error Handler (deve essere ultimo) ───────────────────────────────────
  app.use(errorHandler);

  return app;
}
