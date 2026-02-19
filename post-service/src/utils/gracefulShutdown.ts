/**
 * Graceful Shutdown — Post Service
 *
 * Fix: accetta un callback opzionale `onShutdown` eseguito prima di
 * disconnettere l'infrastruttura. Questo evita di registrare più handler
 * sullo stesso segnale (SIGTERM/SIGINT) in punti diversi del codice.
 */

import { Server } from 'http';
import { logger } from './logger';
import { disconnectDatabase } from '../config/database';
import { disconnectRedis } from '../config/redis';
import { disconnectKafka } from '../config/kafka';

let isShuttingDown = false;

export function setupGracefulShutdown(
  server: Server,
  onShutdown?: () => void | Promise<void>,
): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }
    isShuttingDown = true;
    logger.info(`${signal} received, starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        // Callback opzionale (es. scheduler.stop())
        if (onShutdown) await onShutdown();

        await disconnectDatabase();
        await disconnectRedis();
        await disconnectKafka();
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
  process.on('SIGINT', () => shutdown('SIGINT'));
}
