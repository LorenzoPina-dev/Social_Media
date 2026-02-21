import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notification_preferences', (table) => {
    table.uuid('user_id').primary();
    table.boolean('likes_push').notNullable().defaultTo(true);
    table.boolean('likes_email').notNullable().defaultTo(false);
    table.boolean('comments_push').notNullable().defaultTo(true);
    table.boolean('comments_email').notNullable().defaultTo(false);
    table.boolean('follows_push').notNullable().defaultTo(true);
    table.boolean('follows_email').notNullable().defaultTo(true);
    table.boolean('mentions_push').notNullable().defaultTo(true);
    table.boolean('mentions_email').notNullable().defaultTo(false);
    table.time('quiet_hours_start').nullable();   // es. 22:00
    table.time('quiet_hours_end').nullable();     // es. 08:00
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notification_preferences');
}
