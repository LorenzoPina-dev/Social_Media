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
import { connectKafka } from './config/kafka';

export async function createApp(): Promise<Application> {
  const app: Application = express();
  app.set('trust proxy', 1);

  // Security
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  // Body parsing & compression
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());

  // Request logging
  app.use(requestLogger);

  // Connect to infrastructure
  logger.info('📦 Connecting to infrastructure...');
  await connectRedis();

  // Kafka is non-blocking
  connectKafka().catch((err) => {
    logger.warn('Kafka connection failed, continuing without Kafka', { err });
  });

  logger.info('✅ Infrastructure connected');

  // Health endpoints
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'feed-service',
      version: config.VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (_req, res) => {
    try {
      const redis = getRedisClient();
      await redis.ping();

      res.json({
        status: 'ready',
        checks: { redis: 'ok' },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('Readiness check failed', { err });
      res.status(503).json({ status: 'not ready', error: 'Health check failed' });
    }
  });

  // API routes
  setupRoutes(app);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
