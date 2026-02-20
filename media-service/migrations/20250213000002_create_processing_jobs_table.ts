import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('processing_jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('media_id').notNullable().references('id').inTable('media_files').onDelete('CASCADE');
    // ENUM: IMAGE_RESIZE | VIDEO_TRANSCODE | VIRUS_SCAN
    table.string('job_type', 30).notNullable();
    // ENUM: QUEUED | PROCESSING | DONE | FAILED
    table.string('status', 20).notNullable().defaultTo('QUEUED');
    table.text('error_message').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('completed_at', { useTz: true }).nullable();
  });

  await knex.raw('CREATE INDEX idx_jobs_media_id ON processing_jobs(media_id)');
  await knex.raw('CREATE INDEX idx_jobs_status ON processing_jobs(status)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('processing_jobs');
}
