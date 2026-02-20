/**
 * Graceful Shutdown Handler
 */

import { Server } from 'http';
import { logger } from './logger';
import { disconnectDatabase } from '../config/database';
import { disconnectRedis } from '../config/redis';
import { disconnectKafka } from '../config/kafka';

let isShuttingDown = false;

export function setupGracefulShutdown(server: Server): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`${signal} received, starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await disconnectKafka();
        await disconnectDatabase();
        await disconnectRedis();
        logger.info('✅ All connections closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown', { error });
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('❌ Forceful shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}
