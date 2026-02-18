import { Knex } from 'knex';

/**
 * Migration: create followers table — user-service
 *
 * FK verso users(id) con CASCADE: se un utente viene eliminato (hard delete)
 * le sue relazioni di follow vengono rimosse automaticamente.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('followers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('follower_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('following_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['follower_id', 'following_id'], { indexName: 'uq_followers_pair' });
  });

  await knex.schema.raw('CREATE INDEX idx_followers_follower_id ON followers(follower_id)');
  await knex.schema.raw('CREATE INDEX idx_followers_following_id ON followers(following_id)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('followers');
}
