/**
 * Database Configuration
 * PostgreSQL with Knex.js
 */

import knex, { Knex } from 'knex';
import { config } from './index';
import { logger } from '../utils/logger';

let db: Knex | null = null;

/**
 * Database configuration
 */
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

/**
 * Connect to database
 */
export async function connectDatabase(): Promise<Knex> {
  try {
    if (db) {
      return db;
    }

    db = knex(dbConfig);

    // Test connection
    await db.raw('SELECT 1');
    
    logger.info('✅ Database connected successfully');
    
    return db;
  } catch (error) {
    logger.error('❌ Failed to connect to database', { error });
    throw error;
  }
}

/**
 * Get database instance
 */
export function getDatabase(): Knex {
  if (!db) {
    throw new Error('Database not initialized. Call connectDatabase() first.');
  }
  return db;
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
    logger.info('Database disconnected');
  }
}

export { db };
export default db;
