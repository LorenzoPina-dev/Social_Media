import { Knex } from 'knex';

/**
 * Migration: create post_edit_history table — post-service / post_db
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('post_edit_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE');
    table.text('previous_content').notNullable();
    table.timestamp('edited_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_edit_history_post ON post_edit_history(post_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('post_edit_history');
}
