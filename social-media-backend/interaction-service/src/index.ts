/**
 * Interaction Service — Main Entry Point
 *
 * Responsabilità: Like, commenti nested (closure table), share, contatori real-time
 * Porta: 3005
 */
import 'express-async-errors';
import { config } from './config';
import { logger } from './utils/logger';
import { startMetricsServer } from './utils/metrics';
import { setupGracefulShutdown } from './utils/gracefulShutdown';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
  try {
    logger.info('🚀 Starting Interaction Service...', {
      version: config.VERSION,
      node: process.version,
      env: config.NODE_ENV,
    });

    const app = await createApp();

    const server = app.listen(config.PORT, () => {
      logger.info(`🎉 Interaction Service listening on port ${config.PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info(`🔗 API: http://localhost:${config.PORT}/api/v1`);
      logger.info(`📖 Health: http://localhost:${config.PORT}/health`);
    });

    startMetricsServer();
    setupGracefulShutdown(server);
  } catch (error) {
    logger.error('❌ Failed to start Interaction Service', { error });
    process.exit(1);
  }
}

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection', { reason });
  process.exit(1);
});

bootstrap();
