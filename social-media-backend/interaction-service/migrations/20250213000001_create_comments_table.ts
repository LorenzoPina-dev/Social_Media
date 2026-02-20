import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('comments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('post_id').notNullable();                          // no FK cross-DB
    table.uuid('user_id').notNullable();
    table.uuid('parent_id').nullable().references('id').inTable('comments');
    table.text('content').notNullable();
    table.integer('like_count').notNullable().defaultTo(0);
    table.integer('depth').notNullable().defaultTo(0);
    table.specificType('moderation_status', 'VARCHAR(20)').notNullable().defaultTo('APPROVED');
    table.timestamps(true, true);  // created_at, updated_at with timezone
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Indexes
    table.index(['post_id', 'created_at'], 'idx_comments_post_created');
    table.index(['parent_id'], 'idx_comments_parent');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('comments');
}
