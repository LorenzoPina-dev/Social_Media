/**
 * User Service - Main Entry Point
 * 
 * Handles user management, profiles, followers/following, GDPR compliance
 * 
 * @module user-service
 */
import 'express-async-errors';
import { config } from './config';
import { logger } from './utils/logger';
import { startMetricsServer } from './utils/metrics';
import { setupGracefulShutdown } from './utils/gracefulShutdown';
import { createApp } from './app';

/**
 * Bootstrap the User Service
 */
async function bootstrap(): Promise<void> {
  try {
    logger.info('🚀 Starting User Service...', {
      version: process.env.npm_package_version || '1.0.0',
      node: process.version,
      env: config.NODE_ENV,
    });

    // Connect to infrastructure
    

    // Create app
    const app = await createApp();

    // Start HTTP server
    const PORT = config.PORT || 3002;
    const server = app.listen(PORT, () => {
      logger.info(`🎉 User Service listening on port ${PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info(`🔗 API: http://localhost:${PORT}/api/v1`);
      logger.info(`📖 Health: http://localhost:${PORT}/health`);
    });

    // Start metrics server
    startMetricsServer();

    // Setup graceful shutdown
    setupGracefulShutdown(server);

  } catch (error) {
    logger.error('❌ Failed to start User Service', { error });
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

logger.info('✅ inizio');
// Start the service
bootstrap();
