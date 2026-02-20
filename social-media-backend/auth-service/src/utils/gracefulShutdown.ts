/**
 * Graceful Shutdown Handler
 * Ensures clean shutdown of all connections
 */

import { Server } from 'http';
import { logger } from './logger';
import { disconnectDatabase } from '../config/database';
import { disconnectRedis } from '../config/redis';
import { disconnectKafka } from '../config/kafka';

let isShuttingDown = false;

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown(server: Server): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    isShuttingDown = true;
    logger.info(`${signal} received, starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close all connections
        await Promise.all([
          disconnectDatabase(),
          disconnectRedis(),
          disconnectKafka(),
        ]);

        logger.info('✅ All connections closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown', { error });
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('❌ Forceful shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
