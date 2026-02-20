/**
 * Database Configuration
 * PostgreSQL with Knex.js
 */

import knex, { Knex } from 'knex';
import { config } from './index';
import { logger } from '../utils/logger';

let db: Knex | null = null;

const dbConfig: Knex.Config = {
  client: 'postgresql',
  connection: config.DATABASE_URL,
  pool: {
    min: config.DB_POOL_MIN,
    max: config.DB_POOL_MAX,
    idleTimeoutMillis: config.DB_IDLE_TIMEOUT,
    acquireTimeoutMillis: config.DB_CONNECTION_TIMEOUT,
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './seeds',
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
    logger.error('❌ Failed to connect to database', { error });
    throw error;
  }
}

export function getDatabase(): Knex {
  if (!db) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
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
export default db;
