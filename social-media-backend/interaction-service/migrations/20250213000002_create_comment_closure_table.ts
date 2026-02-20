import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('comment_closure', (table) => {
    table.uuid('ancestor_id').notNullable().references('id').inTable('comments').onDelete('CASCADE');
    table.uuid('descendant_id').notNullable().references('id').inTable('comments').onDelete('CASCADE');
    table.integer('depth').notNullable();
    table.primary(['ancestor_id', 'descendant_id']);

    table.index(['descendant_id'], 'idx_comment_closure_descendant');
    table.index(['ancestor_id'], 'idx_comment_closure_ancestor');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('comment_closure');
}
