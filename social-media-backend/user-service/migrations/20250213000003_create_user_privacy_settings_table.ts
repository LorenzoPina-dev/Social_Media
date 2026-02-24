import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_privacy_settings', (table) => {
    table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    table.boolean('is_private').notNullable().defaultTo(false);
    table.boolean('show_activity_status').notNullable().defaultTo(true);
    table.boolean('allow_tagging').notNullable().defaultTo(true);
    table.boolean('allow_mentions').notNullable().defaultTo(true);
    table
      .string('allow_direct_messages', 20)
      .notNullable()
      .defaultTo('everyone')
      .checkIn(['everyone', 'followers', 'none'], 'chk_privacy_allow_direct_messages');
    table.specificType('blocked_users', 'jsonb').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    table.specificType('muted_users', 'jsonb').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    table.boolean('hide_likes_and_views').notNullable().defaultTo(false);
    table
      .string('comment_filter', 20)
      .notNullable()
      .defaultTo('everyone')
      .checkIn(['everyone', 'followers', 'none'], 'chk_privacy_comment_filter');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_privacy_settings');
}
