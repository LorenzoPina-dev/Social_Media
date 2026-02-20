#!/usr/bin/env ts-node
/**
 * Database Initialization Script — moderation-service
 *
 * Crea il DB principale (moderation_db) E il DB di test (moderation_test_db),
 * poi gestisce migration, rollback e seed.
 *
 * Utilizzo:
 *   ts-node scripts/init-db.ts                → crea entrambi i DB + migrate
 *   ts-node scripts/init-db.ts --migrate       → solo migration pending
 *   ts-node scripts/init-db.ts --rollback      → rollback ultimo batch
 *   ts-node scripts/init-db.ts --rollback-all  → rollback tutte le migration
 *   ts-node scripts/init-db.ts --fresh         → rollback all + migrate
 *   ts-node scripts/init-db.ts --status        → stato migration
 *   ts-node scripts/init-db.ts --test-only     → crea/migra solo il test DB
 */

import path from 'path';
import knex, { Knex } from 'knex';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

// ─── Config ───────────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/moderation_db';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  DATABASE_URL.replace(/\/([^/?]+)(\?|$)/, '/moderation_test_db$2');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const log = (msg: string) => console.log(`[init-db] ${msg}`);
const ok  = (msg: string) => console.log(`[init-db] ✅ ${msg}`);
const warn = (msg: string) => console.warn(`[init-db] ⚠️  ${msg}`);
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

// ─── Crea DB se non esiste ────────────────────────────────────────────────────

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

function buildKnex(connectionString: string): Knex {
  return knex({
    client: 'pg',
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

// ─── Migration helpers ────────────────────────────────────────────────────────

async function migrate(db: Knex, label: string): Promise<void> {
  log(`[${label}] Eseguo migration pending...`);
  const [batchNo, migrations] = await db.migrate.latest();
  if (migrations.length === 0) {
    log(`[${label}] Nessuna migration pending — DB aggiornato`);
    return;
  }
  ok(`[${label}] Batch ${batchNo}: ${migrations.length} migration eseguite:`);
  migrations.forEach((m: string) => console.log(`    → ${path.basename(m)}`));
}

async function rollback(db: Knex, label: string, all = false): Promise<void> {
  const msg = all ? 'TUTTE le migration' : 'ultimo batch';
  log(`[${label}] Rollback ${msg}...`);
  const [batchNo, migrations] = await db.migrate.rollback(undefined, all);
  if (migrations.length === 0) {
    log(`[${label}] Niente da rollback`);
    return;
  }
  ok(`[${label}] Rollback batch ${batchNo}: ${migrations.length} migration:`);
  migrations.forEach((m: string) => console.log(`    ← ${path.basename(m)}`));
}

async function status(db: Knex, label: string): Promise<void> {
  const [done, pending] = (await db.migrate.list()) as [string[], string[]];
  console.log(`\n  [${label}] Migration completate:`);
  done.length === 0
    ? console.log('    (nessuna)')
    : done.forEach((m) => console.log(`    ✅ ${path.basename(m)}`));
  console.log(`\n  [${label}] Migration pending:`);
  pending.length === 0
    ? console.log('    (nessuna)')
    : pending.forEach((m) => console.log(`    ⏳ ${path.basename(m)}`));
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const doMigrate      = args.includes('--migrate');
  const doRollback     = args.includes('--rollback');
  const doRollbackAll  = args.includes('--rollback-all');
  const doFresh        = args.includes('--fresh');
  const doStatus       = args.includes('--status');
  const testOnly       = args.includes('--test-only');
  const noArgs         = args.length === 0;

  log(`DB principale : ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);
  log(`DB di test    : ${TEST_DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`);

  // ── Crea i DB fisici ────────────────────────────────────────────────────────
  if (!testOnly) {
    await createDatabaseIfNotExists(DATABASE_URL);
  }
  await createDatabaseIfNotExists(TEST_DATABASE_URL);

  // ── Costruisce le connessioni ────────────────────────────────────────────────
  const dbMain = testOnly ? null : buildKnex(DATABASE_URL);
  const dbTest = buildKnex(TEST_DATABASE_URL);

  try {
    // ── Status ────────────────────────────────────────────────────────────────
    if (doStatus) {
      if (dbMain) await status(dbMain, 'moderation_db');
      await status(dbTest, 'moderation_test_db');
      return;
    }

    // ── Fresh ─────────────────────────────────────────────────────────────────
    if (doFresh) {
      if (dbMain) {
        await rollback(dbMain, 'moderation_db', true);
        await migrate(dbMain, 'moderation_db');
      }
      await rollback(dbTest, 'moderation_test_db', true);
      await migrate(dbTest, 'moderation_test_db');
      ok('Fresh completato su entrambi i DB');
      return;
    }

    // ── Rollback all ──────────────────────────────────────────────────────────
    if (doRollbackAll) {
      if (dbMain) await rollback(dbMain, 'moderation_db', true);
      await rollback(dbTest, 'moderation_test_db', true);
      return;
    }

    // ── Rollback last batch ───────────────────────────────────────────────────
    if (doRollback) {
      if (dbMain) await rollback(dbMain, 'moderation_db');
      await rollback(dbTest, 'moderation_test_db');
      return;
    }

    // ── Default / --migrate: migrate entrambi ─────────────────────────────────
    if (dbMain) await migrate(dbMain, 'moderation_db');
    await migrate(dbTest, 'moderation_test_db');

    ok('Inizializzazione database completata');
    if (!testOnly) {
      log('  moderation_db      → pronto per sviluppo');
    }
    log('  moderation_test_db → pronto per i test (npm test)');

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
