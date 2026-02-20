/**
 * E2E Database Helper — media-service
 *
 * Provides:
 *  - A shared real Knex connection to the test database
 *  - Table truncation between tests (preserves schema)
 *  - Low-level row insertion for test setup
 */

import path from 'path';
import knex, { Knex } from 'knex';

let _db: Knex | null = null;

export function getTestDb(): Knex {
  if (!_db) {
    const dbUrl =
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      'postgresql://postgres:password@localhost:5432/media_test_db';

    _db = knex({
      client: 'postgresql',
      connection: dbUrl,
      pool: { min: 1, max: 5 },
      migrations: {
        directory: path.join(__dirname, '../../../migrations'),
        tableName: 'knex_migrations',
        extension: 'ts',
        loadExtensions: ['.ts'],
      },
    });
  }
  return _db;
}

/** Truncate all app tables in dependency order, resetting them between tests */
export async function truncateAllTables(): Promise<void> {
  const db = getTestDb();
  // processing_jobs references media_files via FK — truncate child first
  await db.raw('TRUNCATE TABLE processing_jobs, media_files RESTART IDENTITY CASCADE');
}

/** Destroy the shared connection (call in afterAll) */
export async function destroyTestDb(): Promise<void> {
  if (_db) {
    await _db.destroy();
    _db = null;
  }
}

// ─── Row insertion helpers ────────────────────────────────────────────────────

export interface SeedMediaOptions {
  id?: string;
  user_id?: string;
  original_filename?: string;
  content_type?: string;
  size_bytes?: number;
  storage_key?: string;
  cdn_url?: string | null;
  thumbnail_url?: string | null;
  blurhash?: string | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  status?: string;
  virus_scan_status?: string;
}

export async function seedMediaFile(opts: SeedMediaOptions = {}): Promise<{
  id: string;
  user_id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  cdn_url: string | null;
  thumbnail_url: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  status: string;
  virus_scan_status: string;
  created_at: Date;
  processed_at: Date | null;
}> {
  const db = getTestDb();
  const userId = opts.user_id ?? 'e2e-user-00000000-0000-0000-0000-000000000001';
  const mediaId = opts.id ?? require('crypto').randomUUID();
  const storageKey = opts.storage_key ?? `${userId}/${mediaId}/${opts.original_filename ?? 'file.jpg'}`;

  const data = {
    id: mediaId,
    user_id: userId,
    original_filename: opts.original_filename ?? 'test-file.jpg',
    content_type: opts.content_type ?? 'image/jpeg',
    size_bytes: opts.size_bytes ?? 1024 * 100,
    storage_key: storageKey,
    cdn_url: opts.cdn_url !== undefined ? opts.cdn_url : `http://localhost:9000/test-bucket/${storageKey}`,
    thumbnail_url: opts.thumbnail_url !== undefined ? opts.thumbnail_url : null,
    blurhash: opts.blurhash !== undefined ? opts.blurhash : null,
    width: opts.width !== undefined ? opts.width : null,
    height: opts.height !== undefined ? opts.height : null,
    duration_seconds: opts.duration_seconds !== undefined ? opts.duration_seconds : null,
    status: opts.status ?? 'READY',
    virus_scan_status: opts.virus_scan_status ?? 'CLEAN',
    created_at: new Date(),
    processed_at: opts.status === 'READY' ? new Date() : null,
  };

  const [row] = await db('media_files').insert(data).returning('*');
  return row;
}

export async function seedProcessingJob(opts: {
  media_id: string;
  job_type?: string;
  status?: string;
  error_message?: string | null;
}): Promise<{
  id: string;
  media_id: string;
  job_type: string;
  status: string;
  error_message: string | null;
  created_at: Date;
  completed_at: Date | null;
}> {
  const db = getTestDb();
  const [row] = await db('processing_jobs')
    .insert({
      media_id: opts.media_id,
      job_type: opts.job_type ?? 'IMAGE_RESIZE',
      status: opts.status ?? 'DONE',
      error_message: opts.error_message ?? null,
      created_at: new Date(),
      completed_at: opts.status === 'DONE' || opts.status === 'FAILED' ? new Date() : null,
    })
    .returning('*');
  return row;
}

/** Directly fetch a media_file row from the DB for assertion */
export async function findMediaById(id: string): Promise<any | null> {
  const db = getTestDb();
  const row = await db('media_files').where({ id }).first();
  return row ?? null;
}

/** Directly fetch processing_jobs for a media ID */
export async function findJobsByMediaId(mediaId: string): Promise<any[]> {
  const db = getTestDb();
  return db('processing_jobs').where({ media_id: mediaId }).orderBy('created_at', 'asc');
}
