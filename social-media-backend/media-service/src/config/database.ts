/**
 * Database Configuration — media-service
 * PostgreSQL with Knex.js
 *
 * Fix log:
 *  - BUGFIX: acquireTimeoutMillis was 2000ms (too short for cold Docker containers).
 *    Now reads from DB_CONNECTION_TIMEOUT env var, defaulting to 10000ms.
 *  - BUGFIX: Added explicit createTimeoutMillis for initial connection.
 *  - BUGFIX: propagateCreateError: false prevents pool from crashing the whole
 *    app when a single connection attempt fails at startup.
 */

import knex, { Knex } from 'knex';
import { config } from './index';
import { logger } from '../utils/logger';

let db: Knex | null = null;

const dbConfig: Knex.Config = {
  client: 'postgresql',
  connection: {
    connectionString: config.DATABASE_URL,
    // FIX: explicit connection-level timeout (separate from pool acquire timeout)
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
  },
  pool: {
    min: config.DB_POOL_MIN,
    max: config.DB_POOL_MAX,
    idleTimeoutMillis: config.DB_IDLE_TIMEOUT,
    // FIX: increased from 2000ms to 10000ms — cold Docker containers are slow
    acquireTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
    createTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
    // FIX: don't propagate pool creation errors — prevents startup crash on
    // transient connection failures (the caller's try-catch handles it)
    propagateCreateError: false,
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
};

export async function connectDatabase(): Promise<Knex> {
  if (db) return db;
  try {
    db = knex(dbConfig);
    await db.raw('SELECT 1');
    logger.info('✅ Database connected successfully');
    return db;
  } catch (error) {
    // Reset db so a retry attempt can try again
    db = null;
    logger.error('❌ Failed to connect to database', { error });
    throw error;
  }
}

export function getDatabase(): Knex {
  if (!db) throw new Error('Database not initialized. Call connectDatabase() first.');
  return db;
}

export async function disconnectDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
    logger.info('Database disconnected');
  }
}

export { db };
