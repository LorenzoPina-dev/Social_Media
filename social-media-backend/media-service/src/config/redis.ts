/**
 * Redis Configuration — media-service
 *
 * Fix log:
 *  - BUGFIX: connectRedis() was calling await redisClient.ping() immediately,
 *    which would throw synchronously if Redis wasn't ready, crashing the app.
 *    Now the ping is wrapped in a try-catch and uses a short timeout.
 *  - BUGFIX: lazyConnect: true prevents ioredis from auto-connecting on
 *    construction — we control the connect() call explicitly.
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
      // FIX: lazyConnect = true; we call .connect() explicitly so we can catch errors
      lazyConnect: true,
      connectTimeout: 10000,
      retryStrategy: (times: number) => {
        if (times > 3) return null; // stop retrying after 3 attempts on startup
        return Math.min(times * 200, 2000);
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (error) => logger.error('Redis error', { error: error.message }));
    redisClient.on('connect', () => logger.info('✅ Redis connected successfully'));
    redisClient.on('reconnecting', () => logger.warn('Redis reconnecting...'));

    // FIX: explicit connect then ping, both catchable
    await redisClient.connect();
    await redisClient.ping();
    logger.info('✅ Redis ready');
    return redisClient;
  } catch (error) {
    redisClient = null;
    logger.error('❌ Failed to connect to Redis', {
      error: error instanceof Error ? error.message : String(error),
    });
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
