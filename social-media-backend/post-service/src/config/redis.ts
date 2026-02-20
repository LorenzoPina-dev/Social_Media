/**
 * Redis Configuration — ioredis
 */

import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export async function connectRedis(): Promise<Redis> {
  if (redisClient) return redisClient;
  try {
    redisClient = new Redis(config.REDIS_URL, {
      password: config.REDIS_PASSWORD,
      tls: config.REDIS_TLS ? {} : undefined,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (error) => logger.error('Redis error', { error }));
    redisClient.on('connect', () => logger.info('✅ Redis connected successfully'));
    redisClient.on('ready', () => logger.info('Redis ready'));
    redisClient.on('reconnecting', () => logger.warn('Redis reconnecting...'));

    await redisClient.ping();
    return redisClient;
  } catch (error) {
    logger.error('❌ Failed to connect to Redis', { error });
    throw error;
  }
}

export function getRedisClient(): Redis {
  if (!redisClient) throw new Error('Redis not initialized. Call connectRedis() first.');
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
export default redisClient;
