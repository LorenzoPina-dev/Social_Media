/**
 * Auth Service - Main Entry Point
 * 
 * Handles authentication, authorization, JWT tokens, MFA, OAuth2
 * 
 * @module auth-service
 */

import 'express-async-errors';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { setupRoutes } from './routes';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { connectKafka } from './config/kafka';
import { startMetricsServer } from './utils/metrics';
import { errorHandler } from './middleware/errorHandler';
import { setupGracefulShutdown } from './utils/gracefulShutdown';
import { requestLogger } from './middleware/requestLogger';

/**
 * Bootstrap the Auth Service
 */
async function bootstrap(): Promise<void> {
  try {
    logger.info('🚀 Starting Auth Service...', {
      version: process.env.npm_package_version || '1.0.0',
      node: process.version,
      env: config.NODE_ENV,
    });

    const app: Application = express();

    // Trust proxy (for rate limiting and IP detection)
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
    app.use(cors({
      origin: config.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Body parsing & compression
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(compression());

    // Request logging
    app.use(requestLogger);

    // Connect to infrastructure
    logger.info('📦 Connecting to infrastructure...');
    await Promise.all([
      connectDatabase(),
      connectRedis(),
      connectKafka(),
    ]);
    logger.info('✅ Infrastructure connected successfully');

    // Setup routes
    setupRoutes(app);

    // Health checks
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'auth-service',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });

    app.get('/health/ready', async (req, res) => {
      try {
        const { getDatabase } = await import('./config/database');
        const { getRedisClient } = await import('./config/redis');
        
        const db = getDatabase();
        const redis = getRedisClient();

        await db.raw('SELECT 1');
        await redis.ping();

        res.json({
          status: 'ready',
          checks: {
            database: 'ok',
            redis: 'ok',
            kafka: 'ok',
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

    // Error handling (must be last)
    app.use(errorHandler);

    // Start HTTP server
    const PORT = config.PORT || 3001;
    const server = app.listen(PORT, () => {
      logger.info(`🎉 Auth Service listening on port ${PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info(`🔗 API: http://localhost:${PORT}/api/v1`);
      logger.info(`📖 Health: http://localhost:${PORT}/health`);
    });

    // Start metrics server
    startMetricsServer();

    // Setup graceful shutdown
    setupGracefulShutdown(server);

  } catch (error) {
    logger.error('❌ Failed to start Auth Service', { error });
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection', { reason });
  process.exit(1);
});

// Start the service
bootstrap();
