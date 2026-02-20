/**
 * Post Service — Entry Point
 */

import 'express-async-errors';
import { config } from './config';
import { logger } from './utils/logger';
import { startMetricsServer } from './utils/metrics';
import { setupGracefulShutdown } from './utils/gracefulShutdown';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
  try {
    logger.info('🚀 Starting Post Service...', {
      version: config.VERSION,
      node: process.version,
      env: config.NODE_ENV,
    });

    const { app, scheduler } = await createApp();

    const server = app.listen(config.PORT, () => {
      logger.info(`🎉 Post Service listening on port ${config.PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info(`🔗 API: http://localhost:${config.PORT}/api/v1`);
      logger.info(`📖 Health: http://localhost:${config.PORT}/health`);
    });

    startMetricsServer();

    // setupGracefulShutdown gestisce SIGTERM e SIGINT.
    // Il callback ferma lo scheduler prima di chiudere le connessioni,
    // evitando registrazioni duplicate di handler sui segnali.
    setupGracefulShutdown(server, () => scheduler.stop());
  } catch (error) {
    logger.error('❌ Failed to start Post Service', { error });
    process.exit(1);
  }
}

process.on('uncaughtException', (error: Error) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection', reason);
  process.exit(1);
});

bootstrap();
