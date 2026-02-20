import { Server } from 'http';
import { closeDatabase } from '../config/database';
import { closeRedis } from '../config/redis';
import { disconnectKafka } from '../config/kafka';
import { logger } from './logger';

export function setupGracefulShutdown(server: Server): void {
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — starting graceful shutdown`);

    // Step 1: Stop accepting new HTTP connections
    server.close(async () => {
      logger.info('HTTP server closed');
    });

    // Step 2: Wait for in-flight requests (max 30s)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        logger.warn('Forced shutdown after 30s timeout');
        resolve();
      }, 30_000);

      server.once('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    try {
      // Step 3: Kafka producer flush + disconnect
      await disconnectKafka();
      logger.info('Kafka disconnected');

      // Step 4: Close PostgreSQL pool
      await closeDatabase();
      logger.info('Database connection closed');

      // Step 5: Close Redis
      await closeRedis();
      logger.info('Redis connection closed');

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { error: err });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
