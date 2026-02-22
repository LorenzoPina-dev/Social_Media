#!/usr/bin/env ts-node
/**
 * Database Initialization Script — post-service
 *
 * Crea il DB principale (post_db) E il DB di test (post_test_db),
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
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

// ─── Config ───────────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/post_db';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  DATABASE_URL.replace(/\/([^/?]+)(\?|$)/, '/post_test_db$2');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const log = (msg: string) => console.log(`[init-db] ${msg}`);
const ok  = (msg: string) => console.log(`[init-db] ✅ ${msg}`);
const err  = (msg: string) => console.error(`[init-db] ❌ ${msg}`);

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

// ─── Create DB if not exists ───────────────────────────────────────────────────

async function createDatabaseIfNotExists(dbUrl: string): Promise<void> {
  const { host, port, user, password, database } = parseDbUrl(dbUrl);
  log(`Verifico database "${database}"...`);

  const admin = new Client({ host, port, user, password, database: 'postgres' });
  try {
    await admin.connect();
    const { rowCount } = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database],
    );
    if ((rowCount ?? 0) === 0) {
      await admin.query(`CREATE DATABASE "${database}"`);
      ok(`Database "${database}" creato`);
    } else {
      log(`Database "${database}" già esistente — skip`);
    }
  } finally {
    await admin.end();
  }
}

// ─── Knex factory ─────────────────────────────────────────────────────────────
// Rileva se il processo gira come JS compilato (produzione) o ts-node (sviluppo)
const IS_COMPILED = __filename.endsWith('.js');
const MIGRATION_EXT = IS_COMPILED ? 'js' : 'ts';
const LOAD_EXTS    = IS_COMPILED ? ['.js'] : ['.ts'];
const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

function buildKnex(connectionString: string): Knex {
  return knex({
    client: 'postgresql',
    connection: connectionString,
    pool: { min: 1, max: 5 },
    migrations: {
      directory: MIGRATIONS_DIR,
      tableName: 'knex_migrations',
      extension: MIGRATION_EXT,
      loadExtensions: LOAD_EXTS,
    },
  });
}

// ─── Migration helpers ────────────────────────────────────────────────────────

async function migrate(db: Knex): Promise<void> {
  log('Running pending migrations...');
  const [batchNo, migrations] = await db.migrate.latest();
  if (migrations.length === 0) {
    log('No pending migrations — database is up to date');
    return;
  }
  ok(`Batch ${batchNo}: ran ${migrations.length} migration(s):`);
  for (const m of migrations) console.log(`    → ${path.basename(m)}`);
}

async function rollback(db: Knex, all = false): Promise<void> {
  const label = all ? 'ALL migrations' : 'last batch';
  log(`Rolling back ${label}...`);
  const [batchNo, migrations] = await db.migrate.rollback(undefined, all);
  if (migrations.length === 0) {
    log('Nothing to rollback');
    return;
  }
  ok(`Rolled back batch ${batchNo}: ${migrations.length} migration(s):`);
  for (const m of migrations) console.log(`    ← ${path.basename(m)}`);
}

async function status(db: Knex): Promise<void> {
  const [done, pending] = (await db.migrate.list()) as [string[], string[]];
  console.log('\n  Completed migrations:');
  done.length === 0 ? console.log('    (none)') : done.forEach((m) => console.log(`    ✅ ${path.basename(m)}`));
  console.log('\n  Pending migrations:');
  pending.length === 0 ? console.log('    (none)') : pending.forEach((m) => console.log(`    ⏳ ${path.basename(m)}`));
  console.log('');
}

async function fresh(db: Knex): Promise<void> {
  await rollback(db, true);
  await migrate(db);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const shouldRollback    = args.includes('--rollback');
  const shouldRollbackAll = args.includes('--rollback-all');
  const shouldFresh       = args.includes('--fresh');
  const shouldStatus      = args.includes('--status');
  const testOnly          = args.includes('--test-only');

  log(`DB principale : ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);
  log(`DB di test    : ${TEST_DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);

  if (!testOnly) await createDatabaseIfNotExists(DATABASE_URL);
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
      ok('Fresh completato su entrambi i DB');
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

    // Default: crea DB + migrate
    if (dbMain) await migrate(dbMain);
    await migrate(dbTest);

    ok('Inizializzazione database completata');
    if (!testOnly) log('  post_db      → pronto per sviluppo');
    log('  post_test_db → pronto per i test (npm test)');

  } catch (e: any) {
    err(`Inizializzazione fallita: ${e.message}`);
    if (process.env.DEBUG) console.error(e);
    process.exit(1);
  } finally {
    if (dbMain) await dbMain.destroy();
    await dbTest.destroy();
  }
}

main();
