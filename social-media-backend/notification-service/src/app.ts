import 'express-async-errors';
import express, { Application } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { setupRoutes, createNotificationService } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { connectKafka } from './config/kafka';
import { websocketService } from './services/websocket.service';
import { InteractionConsumer } from './kafka/consumers/interaction.consumer';
import { UserEventConsumer } from './kafka/consumers/user.consumer';
import { PostEventConsumer } from './kafka/consumers/post.consumer';
import { ModerationConsumer } from './kafka/consumers/moderation.consumer';

export async function createApp(): Promise<{ app: Application; httpServer: ReturnType<typeof createServer> }> {
  const app: Application = express();
  app.set('trust proxy', 1);

  // Security
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(compression());
  app.use(requestLogger);

  logger.info('📦 Connecting to infrastructure...');
  await connectDatabase();
  await connectRedis();
  logger.info('✅ DB + Redis connected');

  // HTTP Server (per Socket.io)
  const httpServer = createServer(app);

  // WebSocket
  websocketService.initialize(httpServer);

  // Kafka (non-blocking)
  connectKafka().then(() => {
    const notificationService = createNotificationService();
    const interactionConsumer = new InteractionConsumer(notificationService);
    const userConsumer = new UserEventConsumer(notificationService);
    const postConsumer = new PostEventConsumer(notificationService);
    const moderationConsumer = new ModerationConsumer(notificationService);

    Promise.allSettled([
      interactionConsumer.start(),
      userConsumer.start(),
      postConsumer.start(),
      moderationConsumer.start(),
    ]).then(() => logger.info('✅ Kafka consumers started'));
  }).catch((err) => logger.warn('⚠️  Kafka unavailable', { err }));

  // Health
  app.get('/health', (_, res) => {
    res.json({ status: 'healthy', service: 'notification-service', version: config.VERSION, timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', async (_, res) => {
    try {
      const { getDatabase } = await import('./config/database');
      const { getRedisClient } = await import('./config/redis');
      await getDatabase().raw('SELECT 1');
      await getRedisClient().ping();
      res.json({ status: 'ready', checks: { database: 'ok', redis: 'ok' }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(503).json({ status: 'not ready', error: 'Health check failed' });
    }
  });

  setupRoutes(app);
  app.use(errorHandler);

  return { app, httpServer };
}
