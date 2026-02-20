import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('likes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.uuid('target_id').notNullable();
    table.specificType('target_type', 'VARCHAR(10)').notNullable(); // POST | COMMENT
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Unique constraint — one like per (user, target, type)
    table.unique(['user_id', 'target_id', 'target_type'], { indexName: 'uq_likes_user_target' });

    // Indexes
    table.index(['target_id', 'target_type'], 'idx_likes_target');
    table.index(['user_id'], 'idx_likes_user');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('likes');
}
