/**
 * Graceful Shutdown — ordine: HTTP → Kafka → Redis → Elasticsearch → exit
 */

import { Server } from 'http';
import { logger } from './logger';
import { disconnectRedis } from '../config/redis';
import { disconnectKafka } from '../config/kafka';
import { disconnectElasticsearch } from '../config/elasticsearch';

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
        await disconnectRedis();
        await disconnectElasticsearch();
        logger.info('✅ All connections closed');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', { error: err });
        process.exit(1);
      }
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
