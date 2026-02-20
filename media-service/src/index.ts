import 'express-async-errors';
import { config } from './config';
import { logger } from './utils/logger';
import { startMetricsServer } from './utils/metrics';
import { setupGracefulShutdown } from './utils/gracefulShutdown';
import { createApp } from './app';

async function bootstrap(): Promise<void> {
  try {
    logger.info('🚀 Starting Media Service...', {
      version: process.env.npm_package_version || '1.0.0',
      node: process.version,
      env: config.NODE_ENV,
    });

    const app = await createApp();

    const PORT = config.PORT || 3004;
    const server = app.listen(PORT, () => {
      logger.info(`🎉 Media Service listening on port ${PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info(`🔗 API: http://localhost:${PORT}/api/v1/media`);
      logger.info(`📖 Health: http://localhost:${PORT}/health`);
    });

    startMetricsServer();
    setupGracefulShutdown(server);
  } catch (error) {
    logger.error('❌ Failed to start Media Service', { error });
    process.exit(1);
  }
}

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection', reason);
  process.exit(1);
});

bootstrap();
