#!/usr/bin/env ts-node
/**
 * Database Initialization Script — interaction-service
 *
 * Crea il DB principale (interaction_db) E il DB di test (interaction_test_db),
 * poi gestisce migration e rollback.
 *
 * Utilizzo:
 *   ts-node scripts/init-db.ts               → crea entrambi i DB + migrate
 *   ts-node scripts/init-db.ts --migrate      → solo migration pending
 *   ts-node scripts/init-db.ts --rollback     → rollback ultimo batch
 *   ts-node scripts/init-db.ts --rollback-all → rollback tutte le migration
 *   ts-node scripts/init-db.ts --fresh        → rollback all + migrate
 *   ts-node scripts/init-db.ts --status       → stato migration
 *   ts-node scripts/init-db.ts --test-only    → crea/migra solo il test DB
 */

import path from 'path';
import knex, { Knex } from 'knex';
import { Client } from 'pg';

// ─── Load env ─────────────────────────────────────────────────────────────────
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/interaction_db';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  DATABASE_URL.replace(/\/([^/?]+)(\?|$)/, '/interaction_test_db$2');

// ─── Parse connection URL ──────────────────────────────────────────────────────
function parseDbUrl(url: string): { host: string; port: number; user: string; password: string; database: string } {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 5432,
    user: u.username,
    password: u.password,
    database: u.pathname.replace(/^\//, ''),
  };
}

// ─── Knex config ──────────────────────────────────────────────────────────────
function buildKnex(connectionString: string): Knex {
  return knex({
    client: 'postgresql',
    connection: connectionString,
    pool: { min: 1, max: 5 },
    migrations: {
      directory: path.join(__dirname, '../migrations'),
      tableName: 'knex_migrations',
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(`[init-db] ${msg}`);
}

function success(msg: string): void {
  console.log(`[init-db] ✅ ${msg}`);
}

function warn(msg: string): void {
  console.warn(`[init-db] ⚠️  ${msg}`);
}

function error(msg: string): void {
  console.error(`[init-db] ❌ ${msg}`);
}

// ─── Create DB if not exists ───────────────────────────────────────────────────
async function createDatabaseIfNotExists(dbUrl: string): Promise<void> {
  const { host, port, user, password, database } = parseDbUrl(dbUrl);
  log(`Verifico database "${database}"...`);

  const adminClient = new Client({ host, port, user, password, database: 'postgres' });

  try {
    await adminClient.connect();
    const result = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database],
    );

    if ((result.rowCount ?? 0) === 0) {
      await adminClient.query(`CREATE DATABASE "${database}"`);
      success(`Database "${database}" creato`);
    } else {
      log(`Database "${database}" già esistente — skip`);
    }
  } finally {
    await adminClient.end();
  }
}

// ─── Migrations ───────────────────────────────────────────────────────────────

async function migrate(db: Knex): Promise<void> {
  log('Running pending migrations...');
  const [batchNo, migrations] = await db.migrate.latest();

  if (migrations.length === 0) {
    log('No pending migrations — database is up to date');
    return;
  }

  success(`Batch ${batchNo}: ran ${migrations.length} migration(s):`);
  for (const m of migrations) {
    console.log(`    → ${path.basename(m)}`);
  }
}

async function rollback(db: Knex, all = false): Promise<void> {
  if (all) {
    log('Rolling back ALL migrations...');
    const [batchNo, migrations] = await db.migrate.rollback(undefined, true);
    if (migrations.length === 0) {
      log('Nothing to rollback');
      return;
    }
    success(`Rolled back ${migrations.length} migration(s) (batch ${batchNo})`);
    for (const m of migrations) {
      console.log(`    ← ${path.basename(m)}`);
    }
  } else {
    log('Rolling back last batch...');
    const [batchNo, migrations] = await db.migrate.rollback();
    if (migrations.length === 0) {
      log('Nothing to rollback');
      return;
    }
    success(`Rolled back batch ${batchNo}: ${migrations.length} migration(s):`);
    for (const m of migrations) {
      console.log(`    ← ${path.basename(m)}`);
    }
  }
}

async function status(db: Knex): Promise<void> {
  const completed = await db.migrate.list();
  // knex migrate.list() returns [completedMigrations, pendingMigrations]
  const [done, pending] = completed as [string[], string[]];

  console.log('\n  Completed migrations:');
  if (done.length === 0) {
    console.log('    (none)');
  } else {
    for (const m of done) console.log(`    ✅ ${path.basename(m)}`);
  }

  console.log('\n  Pending migrations:');
  if (pending.length === 0) {
    console.log('    (none)');
  } else {
    for (const m of pending) console.log(`    ⏳ ${path.basename(m)}`);
  }
  console.log('');
}


// ─── Fresh ────────────────────────────────────────────────────────────────────

async function fresh(db: Knex): Promise<void> {
  log('Running fresh: rollback all → migrate → seed...');
  await rollback(db, true);
  await migrate(db);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const shouldCreateDb = args.includes('--create-db');
  const shouldMigrate = args.includes('--migrate');
  const shouldRollback = args.includes('--rollback');
  const shouldRollbackAll = args.includes('--rollback-all');
  const shouldSeed = args.includes('--seed');
  const shouldFresh = args.includes('--fresh');
  const shouldStatus = args.includes('--status');
  const noArgs = args.length === 0;

  const testOnly = args.includes('--test-only');

  log(`DB principale : ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);
  log(`DB di test    : ${TEST_DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);

  // Crea entrambi i DB fisici
  if (!testOnly) {
    await createDatabaseIfNotExists(DATABASE_URL);
  }
  await createDatabaseIfNotExists(TEST_DATABASE_URL);

  const dbMain = testOnly ? null : buildKnex(DATABASE_URL);
  const dbTest = buildKnex(TEST_DATABASE_URL);

  try {
    if (shouldStatus) {
      if (dbMain) await status(dbMain);
      await status(dbTest);
      return;
    }

    if (shouldFresh) {
      if (dbMain) await fresh(dbMain);
      await fresh(dbTest);
      success('Fresh completato su entrambi i DB');
      return;
    }

    if (shouldRollbackAll) {
      if (dbMain) await rollback(dbMain, true);
      await rollback(dbTest, true);
      return;
    }

    if (shouldRollback) {
      if (dbMain) await rollback(dbMain);
      await rollback(dbTest);
      return;
    }

    // Default: migrate entrambi i DB
    if (dbMain) await migrate(dbMain);
    await migrate(dbTest);

    success('Inizializzazione database completata');
    if (!testOnly) log('  interaction_db      → pronto per sviluppo');
    log('  interaction_test_db → pronto per i test (npm test)');

  } catch (err: any) {
    error(`Inizializzazione fallita: ${err.message}`);
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
  } finally {
    if (dbMain) await dbMain.destroy();
    await dbTest.destroy();
  }
}

main();
