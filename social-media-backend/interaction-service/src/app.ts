/**
 * Express Application Factory
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
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { connectKafka } from './config/kafka';

export async function createApp(): Promise<Application> {
  const app: Application = express();
  app.set('trust proxy', 1);

  // Security
  app.use(helmet());
  const corsOptions = {
    origin: config.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));

  // Parsing & compression
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  // Logging
  app.use(requestLogger);

  // Infrastructure
  logger.info('📦 Connecting to infrastructure...');
  await Promise.all([connectDatabase(), connectRedis()]);
  connectKafka().catch(err => logger.warn('⚠️  Kafka unavailable', { err }));
  logger.info('✅ Infrastructure connected');

  // Health endpoints
  app.get('/health', (_, res) => {
    res.json({
      status: 'healthy',
      service: config.SERVICE_NAME,
      version: config.VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (_, res) => {
    try {
      const { getDatabase } = await import('./config/database');
      const { getRedisClient } = await import('./config/redis');
      await getDatabase().raw('SELECT 1');
      await getRedisClient().ping();

      let kafkaStatus = 'ok';
      try { const { getKafkaProducer } = await import('./config/kafka'); getKafkaProducer(); }
      catch { kafkaStatus = 'unavailable'; }

      res.json({ status: 'ready', checks: { database: 'ok', redis: 'ok', kafka: kafkaStatus }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(503).json({ status: 'not ready', error: 'Health check failed' });
    }
  });

  // Routes
  setupRoutes(app);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
