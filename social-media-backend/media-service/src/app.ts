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
import { apiLimiter } from './middleware/rateLimiter';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { connectKafka } from './config/kafka';

export async function createApp(): Promise<Application> {
  const app: Application = express();
  app.set('trust proxy', 1);

  // Security
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }));

  // CORS
  const corsOptions = {
    origin: config.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));

  // Body parsing & compression
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // Request logging & rate limiting
  app.use(requestLogger);
  app.use(apiLimiter);

  // Infrastructure connections
  logger.info('📦 Connecting to infrastructure...');
  await Promise.all([
    connectDatabase(),
    connectRedis(),
    connectKafka(),
  ]);
  logger.info('✅ Infrastructure connected successfully');

  // Health checks
  app.get('/health', (_, res) => {
    res.json({
      status: 'healthy',
      service: 'media-service',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (_, res) => {
    try {
      const { getDatabase } = await import('./config/database');
      const { getRedisClient } = await import('./config/redis');
      await getDatabase().raw('SELECT 1');
      await getRedisClient().ping();
      res.json({ status: 'ready', checks: { database: 'ok', redis: 'ok' }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(503).json({ status: 'not ready', error: 'Health check failed' });
    }
  });

  // API routes
  setupRoutes(app);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
