/**
 * Migration: Create users table
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('users', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // User credentials
    table.string('username', 30).unique().notNullable().index();
    table.string('email', 255).unique().notNullable().index();
    table.string('password_hash', 255).notNullable();

    // Profile info
    table.string('display_name', 100);
    table.string('avatar_url', 500);

    // Security flags
    table.boolean('verified').defaultTo(false).notNullable();
    table.boolean('mfa_enabled').defaultTo(false).notNullable();
    table.string('mfa_secret', 100);

    // Status
    table.enum('status', ['ACTIVE', 'SUSPENDED', 'PENDING_DELETION'])
      .defaultTo('ACTIVE')
      .notNullable();

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('deleted_at');

    // Indexes
    table.index(['status']);
    table.index(['created_at']);
    table.index(['deleted_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('users');
}
