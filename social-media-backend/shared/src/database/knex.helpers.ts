/**
 * Shared Knex Database Helpers
 * Re-usable helpers for creating Knex connections with consistent defaults.
 */

import knex, { Knex } from 'knex';

export interface DatabaseConfig {
  connectionString: string;
  poolMin?: number;
  poolMax?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

/**
 * Create a Knex instance with production-ready defaults.
 */
export function createKnexInstance(cfg: DatabaseConfig): Knex {
  return knex({
    client: 'pg',
    connection: cfg.connectionString,
    pool: {
      min: cfg.poolMin ?? 5,
      max: cfg.poolMax ?? 20,
      idleTimeoutMillis: cfg.idleTimeoutMs ?? 30_000,
      createTimeoutMillis: cfg.connectionTimeoutMs ?? 2_000,
    },
    acquireConnectionTimeout: cfg.connectionTimeoutMs ?? 2_000,
  });
}

/**
 * Run a health-check query.
 */
export async function healthCheck(db: Knex): Promise<boolean> {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Gracefully destroy a Knex connection pool.
 */
export async function destroyKnex(db: Knex): Promise<void> {
  await db.destroy();
}
