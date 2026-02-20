/**
 * E2E Global Setup — media-service
 *
 * Runs ONCE before the entire E2E test suite:
 *  1. Creates the test database if it doesn't exist
 *  2. Drops and recreates all tables (clean slate)
 *  3. Runs all migrations
 *
 * Uses a dedicated test database so it never touches the dev DB.
 */

import path from 'path';
import { Client } from 'pg';
import knex from 'knex';

// Set env before anything else
process.env.NODE_ENV = 'test';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:password@localhost:5432/media_test_db';

function parseDbUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 5432,
    user: u.username,
    password: u.password,
    database: u.pathname.replace(/^\//, ''),
  };
}

async function createTestDatabase(): Promise<void> {
  const { host, port, user, password, database } = parseDbUrl(TEST_DB_URL);

  const adminClient = new Client({ host, port, user, password, database: 'postgres' });
  await adminClient.connect();

  try {
    const result = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [database]
    );
    if (result.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${database}"`);
      console.log(`[e2e:setup] Created test database: ${database}`);
    } else {
      console.log(`[e2e:setup] Test database already exists: ${database}`);
    }
  } finally {
    await adminClient.end();
  }
}

async function runMigrations(): Promise<void> {
  const db = knex({
    client: 'postgresql',
    connection: TEST_DB_URL,
    pool: { min: 1, max: 3 },
    migrations: {
      directory: path.join(__dirname, '../../../migrations'),
      tableName: 'knex_migrations',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
  });

  try {
    // Rollback everything, then re-apply for a guaranteed clean state
    await db.migrate.rollback(undefined, true);
    const [batchNo, migrations] = await db.migrate.latest();
    if (migrations.length > 0) {
      console.log(`[e2e:setup] Applied ${migrations.length} migration(s) in batch ${batchNo}`);
    } else {
      console.log('[e2e:setup] No pending migrations');
    }
  } finally {
    await db.destroy();
  }
}

export default async function globalSetup(): Promise<void> {
  console.log('[e2e:setup] Initializing E2E test environment...');

  // Expose for child processes
  process.env.TEST_DATABASE_URL = TEST_DB_URL;

  await createTestDatabase();
  await runMigrations();

  // Stash URL so teardown can read it
  (global as any).__E2E_DB_URL__ = TEST_DB_URL;

  console.log('[e2e:setup] ✅ E2E environment ready');
}
