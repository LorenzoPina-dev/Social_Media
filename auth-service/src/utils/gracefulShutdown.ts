/**
 * Graceful Shutdown Utility
 * Handles clean shutdown of the service
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
  // Handle SIGTERM
  process.on('SIGTERM', async () => {
    await gracefulShutdown(server, 'SIGTERM');
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    await gracefulShutdown(server, 'SIGINT');
  });

  logger.info('Graceful shutdown handlers registered');
}

/**
 * Perform graceful shutdown
 */
async function gracefulShutdown(server: Server, signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      logger.error('Error closing HTTP server', { error: err });
    } else {
      logger.info('HTTP server closed');
    }
  });

  try {
    // Disconnect from infrastructure in parallel
    logger.info('Closing infrastructure connections...');
    
    await Promise.all([
      disconnectDatabase().catch(error => {
        logger.error('Error disconnecting from database', { error });
      }),
      disconnectRedis().catch(error => {
        logger.error('Error disconnecting from Redis', { error });
      }),
      disconnectKafka().catch(error => {
        logger.error('Error disconnecting from Kafka', { error });
      }),
    ]);

    logger.info('✅ All connections closed successfully');
    logger.info('👋 Shutdown complete');

    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}
