import { Knex } from 'knex';

/**
 * Migration: create hashtags table — post-service / post_db
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('hashtags', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('tag', 100).unique().notNullable();         // lowercase, senza #
    table.integer('post_count').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_hashtags_tag ON hashtags(tag)');
  await knex.raw('CREATE INDEX idx_hashtags_post_count ON hashtags(post_count DESC)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('hashtags');
}
