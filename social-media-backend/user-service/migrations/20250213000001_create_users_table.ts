import { Knex } from 'knex';

/**
 * Migration: create users table — user-service
 *
 * Nota: questa tabella replica le info pubbliche dell'utente da auth_db.
 * L'id è lo STESSO UUID di auth_db.users (nessun auto-increment).
 * La sincronizzazione avviene via Kafka (evento user_registered).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary();                         // stesso UUID di auth_db
    table.string('username', 30).unique().notNullable();
    table.string('email', 255).unique().notNullable();
    table.string('display_name', 100).nullable();
    table.text('bio').nullable();                       // max 500 chars (app-level)
    table.string('avatar_url', 500).nullable();
    table.string('website_url', 500).nullable();
    table.string('location', 100).nullable();
    table.date('birth_date').nullable();
    table.boolean('verified').notNullable().defaultTo(false);
    table.integer('follower_count').notNullable().defaultTo(0);
    table.integer('following_count').notNullable().defaultTo(0);
    table.integer('post_count').notNullable().defaultTo(0);
    table
      .string('status', 20)
      .notNullable()
      .defaultTo('ACTIVE')
      .checkIn(['ACTIVE', 'SUSPENDED', 'PENDING_DELETION'], 'chk_users_status');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });

  await knex.schema.raw('CREATE INDEX idx_users_username ON users(username)');
  await knex.schema.raw('CREATE INDEX idx_users_status ON users(status)');
  await knex.schema.raw(
    'CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
