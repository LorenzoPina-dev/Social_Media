/**
 * Migration: Create mfa_secrets table
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('mfa_secrets', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Foreign key to users
    table.uuid('user_id').unique().notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE')
      .index();

    // MFA data
    table.string('secret', 100).notNullable();
    table.text('backup_codes').notNullable(); // JSON array of backup codes

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('verified_at'); // When user first verified MFA

    // Indexes
    table.index(['verified_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('mfa_secrets');
}
