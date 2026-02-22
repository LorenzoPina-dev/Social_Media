#!/usr/bin/env ts-node
/**
 * Database Initialization Script — media-service
 *
 * Crea il DB principale (media_db) E il DB di test (media_test_db),
 * poi gestisce migration, rollback e seed.
 *
 * Utilizzo:
 *   ts-node scripts/init-db.ts               → crea entrambi i DB + migrate + seed
 *   ts-node scripts/init-db.ts --migrate      → solo migration pending
 *   ts-node scripts/init-db.ts --rollback     → rollback ultimo batch
 *   ts-node scripts/init-db.ts --rollback-all → rollback tutte le migration
 *   ts-node scripts/init-db.ts --seed         → solo seed (nessuna migration)
 *   ts-node scripts/init-db.ts --fresh        → rollback all + migrate + seed
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
  'postgresql://postgres:postgres@localhost:5432/media_db';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  DATABASE_URL.replace(/\/([^/?]+)(\?|$)/, '/media_test_db$2');

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

// ─── Seeding ──────────────────────────────────────────────────────────────────

async function seed(db: Knex): Promise<void> {
  log('Seeding development data...');

  // Check if already seeded
  const existing = await db('media_files').count('id as count').first();
  const count = parseInt(String((existing as any)?.count ?? 0), 10);
  if (count > 0) {
    warn(`Database already has ${count} media file(s) — skipping seed`);
    return;
  }

  const devUserId = '00000000-0000-0000-0000-000000000001';
  const now = new Date();

  // Seed: 3 media files in various states
  const mediaFiles = [
    {
      id: '00000000-0000-0000-0001-000000000001',
      user_id: devUserId,
      original_filename: 'sample-image.jpg',
      content_type: 'image/jpeg',
      size_bytes: 1024 * 256,
      storage_key: `${devUserId}/00000000-0000-0000-0001-000000000001/sample-image.jpg`,
      cdn_url: `http://localhost:9000/social-media-uploads/${devUserId}/00000000-0000-0000-0001-000000000001/sample-image.jpg`,
      thumbnail_url: `http://localhost:9000/social-media-uploads/${devUserId}/00000000-0000-0000-0001-000000000001/sample-image_thumb.jpg`,
      blurhash: 'LGFFaXYk^6#M@-5c,1J5@[or[Q6.',
      width: 1920,
      height: 1080,
      duration_seconds: null,
      status: 'READY',
      virus_scan_status: 'CLEAN',
      created_at: new Date(now.getTime() - 60_000 * 5),
      processed_at: new Date(now.getTime() - 60_000 * 4),
    },
    {
      id: '00000000-0000-0000-0001-000000000002',
      user_id: devUserId,
      original_filename: 'sample-video.mp4',
      content_type: 'video/mp4',
      size_bytes: 1024 * 1024 * 8,
      storage_key: `${devUserId}/00000000-0000-0000-0001-000000000002/sample-video.mp4`,
      cdn_url: `http://localhost:9000/social-media-uploads/${devUserId}/00000000-0000-0000-0001-000000000002/sample-video.mp4`,
      thumbnail_url: `http://localhost:9000/social-media-uploads/${devUserId}/00000000-0000-0000-0001-000000000002/sample-video_thumb.jpg`,
      blurhash: null,
      width: 1280,
      height: 720,
      duration_seconds: 30.5,
      status: 'READY',
      virus_scan_status: 'CLEAN',
      created_at: new Date(now.getTime() - 60_000 * 10),
      processed_at: new Date(now.getTime() - 60_000 * 8),
    },
    {
      id: '00000000-0000-0000-0001-000000000003',
      user_id: devUserId,
      original_filename: 'pending-upload.png',
      content_type: 'image/png',
      size_bytes: 1024 * 512,
      storage_key: `${devUserId}/00000000-0000-0000-0001-000000000003/pending-upload.png`,
      cdn_url: null,
      thumbnail_url: null,
      blurhash: null,
      width: null,
      height: null,
      duration_seconds: null,
      status: 'UPLOADING',
      virus_scan_status: 'PENDING',
      created_at: now,
      processed_at: null,
    },
  ];

  await db('media_files').insert(mediaFiles);

  // Seed processing jobs for the READY media
  const processingJobs = [
    {
      id: '00000000-0000-0000-0002-000000000001',
      media_id: '00000000-0000-0000-0001-000000000001',
      job_type: 'IMAGE_RESIZE',
      status: 'DONE',
      error_message: null,
      created_at: new Date(now.getTime() - 60_000 * 5),
      completed_at: new Date(now.getTime() - 60_000 * 4),
    },
    {
      id: '00000000-0000-0000-0002-000000000002',
      media_id: '00000000-0000-0000-0001-000000000002',
      job_type: 'VIDEO_TRANSCODE',
      status: 'DONE',
      error_message: null,
      created_at: new Date(now.getTime() - 60_000 * 10),
      completed_at: new Date(now.getTime() - 60_000 * 8),
    },
  ];

  await db('processing_jobs').insert(processingJobs);

  success(`Seeded ${mediaFiles.length} media files and ${processingJobs.length} processing jobs`);
  log(`  Dev user ID: ${devUserId}`);
}

// ─── Fresh ────────────────────────────────────────────────────────────────────

async function fresh(db: Knex): Promise<void> {
  log('Running fresh: rollback all → migrate → seed...');
  await rollback(db, true);
  await migrate(db);
  await seed(db);
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
      // Test DB: rollback + migrate (no seed nei test)
      await rollback(dbTest, true);
      await migrate(dbTest);
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

    if (shouldSeed && !shouldMigrate && !noArgs) {
      // Seed solo sul DB principale, mai su test
      if (dbMain) await seed(dbMain);
      return;
    }

    // Default: migrate entrambi
    if (dbMain) await migrate(dbMain);
    await migrate(dbTest);

    // Seed solo sul DB principale in development
    if (dbMain && (noArgs || shouldSeed)) {
      const env = process.env.NODE_ENV || 'development';
      if (env === 'development' || env === 'dev' || shouldSeed) {
        await seed(dbMain);
      } else {
        log(`Seed saltato (NODE_ENV=${env}) — usa --seed per forzare`);
      }
    }

    success('Inizializzazione database completata');
    if (!testOnly) log('  media_db      → pronto per sviluppo');
    log('  media_test_db → pronto per i test (npm test)');

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
