/**
 * Migration: Create password_reset_tokens table
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('password_reset_tokens', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Foreign key to users
    table.uuid('user_id').notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .index();

    // Token data
    table.string('token', 100).unique().notNullable().index();
    table.boolean('used').defaultTo(false).notNullable();

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('expires_at').notNullable().index();

    // Indexes
    table.index(['user_id', 'used']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('password_reset_tokens');
}
