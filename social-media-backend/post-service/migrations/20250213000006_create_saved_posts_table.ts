import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('saved_posts', (table) => {
    table.uuid('user_id').notNullable();
    table.uuid('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(['user_id', 'post_id']);
  });

  await knex.raw('CREATE INDEX idx_saved_posts_user_created ON saved_posts(user_id, created_at DESC)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('saved_posts');
}
