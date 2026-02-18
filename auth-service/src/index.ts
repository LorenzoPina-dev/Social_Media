/**
 * Auth Service - Main Entry Point
 *
 * Handles authentication, authorization, JWT tokens, MFA, OAuth2
 *
 * @module auth-service
 */
import 'express-async-errors';
import { config } from './config';
import { logger } from './utils/logger';
import { startMetricsServer } from './utils/metrics';
import { setupGracefulShutdown } from './utils/gracefulShutdown';
import { createApp } from './app';

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

    // Create app
    const app = await createApp();

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
