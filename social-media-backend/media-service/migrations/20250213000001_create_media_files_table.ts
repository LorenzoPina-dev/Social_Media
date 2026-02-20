import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable pgcrypto for gen_random_uuid()
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('media_files', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.string('original_filename', 255).notNullable();
    table.string('content_type', 100).notNullable();
    table.bigInteger('size_bytes').notNullable();
    table.string('storage_key', 500).unique().notNullable();
    table.string('cdn_url', 500).nullable();
    table.string('thumbnail_url', 500).nullable();
    table.string('blurhash', 100).nullable();
    table.integer('width').nullable();
    table.integer('height').nullable();
    table.float('duration_seconds').nullable();
    // ENUM: UPLOADING | PROCESSING | READY | FAILED | DELETED
    table.string('status', 20).notNullable().defaultTo('UPLOADING');
    // ENUM: PENDING | CLEAN | INFECTED
    table.string('virus_scan_status', 20).notNullable().defaultTo('PENDING');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('processed_at', { useTz: true }).nullable();
  });

  await knex.raw('CREATE INDEX idx_media_user_id ON media_files(user_id)');
  await knex.raw("CREATE INDEX idx_media_status ON media_files(status)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('media_files');
}
