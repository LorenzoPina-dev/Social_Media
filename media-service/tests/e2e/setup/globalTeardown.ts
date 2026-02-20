/**
 * E2E Global Teardown — media-service
 *
 * Runs ONCE after the entire E2E test suite completes.
 * Drops the test schema tables so the DB can be reused cleanly next run.
 * We don't drop the database itself (useful to inspect failures).
 */

import knex from 'knex';
import path from 'path';

export default async function globalTeardown(): Promise<void> {
  const dbUrl =
    (global as any).__E2E_DB_URL__ ||
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:password@localhost:5432/media_test_db';

  const db = knex({
    client: 'postgresql',
    connection: dbUrl,
    pool: { min: 1, max: 2 },
    migrations: {
      directory: path.join(__dirname, '../../../migrations'),
      tableName: 'knex_migrations',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
  });

  try {
    await db.migrate.rollback(undefined, true);
    console.log('[e2e:teardown] ✅ Rolled back all migrations');
  } catch (err: any) {
    console.warn(`[e2e:teardown] Rollback warning: ${err.message}`);
  } finally {
    await db.destroy();
  }
}
