/**
 * Express App Factory — Post Service
 */

import 'express-async-errors';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { logger } from './utils/logger';
import { setupRoutes, getSharedInstances } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { createApiLimiter } from './middleware/rateLimiter';
import { connectDatabase, getDatabase } from './config/database';
import { connectRedis, getRedisClient } from './config/redis';
import { connectKafka, registerKafkaHandler } from './config/kafka';
import { UserEventConsumer } from './kafka/consumers/user.consumer';
import { ModerationEventConsumer } from './kafka/consumers/moderation.consumer';
import { InteractionEventConsumer } from './kafka/consumers/interaction.consumer';
import { SchedulerService } from './services/scheduler.service';

export async function createApp(): Promise<{ app: Application; scheduler: SchedulerService }> {
  const app: Application = express();
  app.set('trust proxy', 1);

  // ─── Security ───────────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }));

  // ─── CORS ────────────────────────────────────────────────────────────────
  app.use(cors({
    origin: config.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());
  app.use(requestLogger);

  // ─── Health (PRIMA del rate limiter — non devono essere rate-limitate) ───
  app.get('/health', (_, res) => {
    res.json({
      status: 'healthy',
      service: 'post-service',
      version: config.VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (_, res) => {
    try {
      const db = getDatabase();
      const redis = getRedisClient();
      await db.raw('SELECT 1');
      await redis.ping();
      res.json({
        status: 'ready',
        checks: { database: 'ok', redis: 'ok' },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(503).json({ status: 'not ready', error: 'Health check failed' });
    }
  });

  // ─── Infrastructure ──────────────────────────────────────────────────────
  logger.info('📦 Connecting to infrastructure...');
  await Promise.all([connectDatabase(), connectRedis(), connectKafka()]);
  logger.info('✅ Infrastructure connected successfully');

  // ─── Rate Limiting (DOPO connectRedis — il Redis store viene creato qui) ─
  app.use(createApiLimiter());

  // ─── Routes (setup + istanze condivise) ──────────────────────────────────
  setupRoutes(app);

  // ─── Kafka consumers (usa le stesse istanze create in routes/) ───────────
  const { postModel, cacheService, hashtagService, postProducer } = getSharedInstances();

  const userConsumer = new UserEventConsumer(postModel);
  const moderationConsumer = new ModerationEventConsumer(postModel, cacheService);
  const interactionConsumer = new InteractionEventConsumer(postModel);

  registerKafkaHandler('user_events', (event) => userConsumer.processMessage(event));
  registerKafkaHandler('moderation_events', (event) => moderationConsumer.processMessage(event));
  registerKafkaHandler('interaction_events', (event) => interactionConsumer.processMessage(event));

  // ─── Scheduler (usa le stesse istanze) ───────────────────────────────────
  const scheduler = new SchedulerService(postModel, postProducer, hashtagService, cacheService);
  scheduler.start();

  // ─── Error Handler (DEVE essere ultimo) ──────────────────────────────────
  app.use(errorHandler);

  return { app, scheduler };
}
