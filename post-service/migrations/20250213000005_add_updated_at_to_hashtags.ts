import { Knex } from 'knex';

/**
 * Migration: add updated_at column to hashtags table
 */
export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('hashtags', 'updated_at');
  if (!hasColumn) {
    await knex.schema.alterTable('hashtags', (table) => {
      table
        .timestamp('updated_at', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('hashtags', 'updated_at');
  if (hasColumn) {
    await knex.schema.alterTable('hashtags', (table) => {
      table.dropColumn('updated_at');
    });
  }
}
