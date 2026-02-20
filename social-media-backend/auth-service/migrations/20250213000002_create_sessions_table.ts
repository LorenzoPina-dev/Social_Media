/**
 * Migration: Create sessions table
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('sessions', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Foreign key to users
    table.uuid('user_id').notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .index();

    // Session data
    table.string('refresh_token', 500).unique().notNullable().index();
    table.string('device_info', 500);
    table.string('ip_address', 45);
    table.string('user_agent', 500);

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('last_activity').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('expires_at').notNullable().index();

    // Indexes
    table.index(['user_id', 'expires_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('sessions');
}
