/**
 * Notification Service — Entry Point
 */
import 'express-async-errors';
import { config } from './config';
import { logger } from './utils/logger';
import { startMetricsServer } from './utils/metrics';
import { setupGracefulShutdown } from './utils/gracefulShutdown';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
  try {
    logger.info('🚀 Starting Notification Service...', {
      version: config.VERSION,
      node: process.version,
      env: config.NODE_ENV,
    });

    const { httpServer } = await createApp();

    const PORT = config.PORT;
    httpServer.listen(PORT, () => {
      logger.info(`🎉 Notification Service listening on port ${PORT}`);
      logger.info(`🔌 WebSocket available at ws://localhost:${PORT}/notifications`);
      logger.info(`📖 Health: http://localhost:${PORT}/health`);
    });

    startMetricsServer();
    setupGracefulShutdown(httpServer);
  } catch (error) {
    logger.error('❌ Failed to start Notification Service', { error });
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
