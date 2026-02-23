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
import { connectKafka, registerTopicHandler } from './config/kafka';
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

  // Health endpoints (prima delle routes per non essere rate-limited)
  app.get('/health', (_, res) => {
    res.json({
      status: 'healthy',
      service: 'notification-service',
      version: config.VERSION,
      timestamp: new Date().toISOString(),
    });
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

  // Routes
  setupRoutes(app);

  // ─── Kafka — non-blocking ────────────────────────────────────────────────
  // L'approccio corretto: connectKafka() apre UN SOLO consumer.run() con
  // dispatcher centralizzato. Qui registriamo gli handler per topic DOPO
  // la connessione, usando registerTopicHandler() esportato da config/kafka.ts.
  //
  // IMPORTANTE: gli handler devono essere registrati PRIMA che arrivino messaggi,
  // quindi vengono registrati subito dopo connectKafka() risolve.
  connectKafka()
    .then(() => {
      // Crea notificationService una sola volta (istanza condivisa)
      const notificationService = createNotificationService();

      // Istanzia i consumer handler (senza subscribe/run — delegato al dispatcher)
      const interactionConsumer = new InteractionConsumer(notificationService);
      const userConsumer = new UserEventConsumer(notificationService);
      const postConsumer = new PostEventConsumer(notificationService);
      const moderationConsumer = new ModerationConsumer(notificationService);

      // Registra un handler per topic nel dispatcher centrale
      registerTopicHandler('interaction_events', (e) => interactionConsumer.processMessage(e));
      registerTopicHandler('user_events',        (e) => userConsumer.processMessage(e));
      registerTopicHandler('post_events',        (e) => postConsumer.processMessage(e));
      registerTopicHandler('moderation_events',  (e) => moderationConsumer.processMessage(e));

      logger.info('✅ Kafka topic handlers registered for notification-service');
    })
    .catch((err) => logger.warn('⚠️  Kafka unavailable', { err }));
  // ────────────────────────────────────────────────────────────────────────

  // Error Handler (deve essere ultimo)
  app.use(errorHandler);

  return { app, httpServer };
}
