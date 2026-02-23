/**
 * Redis Configuration
 */

import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export async function connectRedis(): Promise<Redis> {
  if (redisClient) return redisClient;

  redisClient = new Redis(config.REDIS_URL, {
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    lazyConnect: false,
  });

  redisClient.on('error', (err) => logger.error('Redis error', { error: err.message }));
  redisClient.on('connect', () => logger.info('✅ Redis connected'));
  redisClient.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  await redisClient.ping();
  return redisClient;
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected');
  }
}

export { redisClient };
