import { Knex } from 'knex';

/**
 * Migration: create post_hashtags join table — post-service / post_db
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('post_hashtags', (table) => {
    table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE');
    table.uuid('hashtag_id').notNullable().references('id').inTable('hashtags');
    table.primary(['post_id', 'hashtag_id']);
  });

  await knex.raw('CREATE INDEX idx_post_hashtags_hashtag ON post_hashtags(hashtag_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('post_hashtags');
}
