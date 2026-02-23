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

/**
 * Create Express app
 * Useful for testing
 */
export async function createApp(): Promise<Application> {
  const app: Application = express();
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // CORS configuration
  const corsOptions = {
    origin: config.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.options('*', cors(corsOptions)); // preflight esplicito per tutti i path
  app.use(cors(corsOptions));

  // Body parsing & compression
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // Request logging
  app.use(requestLogger);

  logger.info('📦 Connecting to infrastructure...');

  // Connect to critical infrastructure (database and Redis)
  await Promise.all([
    connectDatabase(),
    connectRedis(),
  ]);

  // Connect to Kafka (non-blocking — service can run without it)
  connectKafka().catch(error => {
    logger.warn('⚠️  Kafka connection failed, continuing without Kafka', { error });
  });

  logger.info('✅ Infrastructure connected successfully');

  // Health checks
  app.get('/health', (_, res) => {
    res.json({
      status: 'healthy',
      service: 'auth-service',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (_, res) => {
    try {
      const { getDatabase } = await import('./config/database');
      const { getRedisClient } = await import('./config/redis');
      const { getKafkaProducer } = await import('./config/kafka');

      const db = getDatabase();
      const redis = getRedisClient();

      await db.raw('SELECT 1');
      await redis.ping();

      // Check Kafka (non-critical)
      let kafkaStatus = 'ok';
      try {
        getKafkaProducer();
      } catch {
        kafkaStatus = 'unavailable';
      }

      res.json({
        status: 'ready',
        checks: {
          database: 'ok',
          redis: 'ok',
          kafka: kafkaStatus,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(503).json({
        status: 'not ready',
        error: 'Health check failed',
      });
    }
  });

  // Setup routes
  setupRoutes(app);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
