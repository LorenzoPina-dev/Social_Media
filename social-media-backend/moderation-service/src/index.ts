import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { connectDatabase } from './config/database';
import { getRedis } from './config/redis';
import { getProducer } from './config/kafka';
import { startPostConsumer } from './kafka/consumers/post.consumer';
import { setupGracefulShutdown } from './utils/gracefulShutdown';
import { logger } from './utils/logger';
import { config } from './config';

async function bootstrap(): Promise<void> {
  logger.info('Starting moderation-service', { port: config.port, env: config.env });

  // 1. Connect to PostgreSQL
  await connectDatabase();
  logger.info('Database connected');

  // 2. Warm up Redis
  getRedis();
  logger.info('Redis connected');

  // 3. Connect Kafka producer
  await getProducer();
  logger.info('Kafka producer connected');

  // 4. Start Kafka consumers
  await startPostConsumer();
  logger.info('Kafka consumers started');

  // 5. Start HTTP server
  const app = createApp();
  const server = http.createServer(app);

  server.listen(config.port, () => {
    logger.info(`moderation-service listening on port ${config.port}`);
  });

  // 6. Graceful shutdown
  setupGracefulShutdown(server);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});
