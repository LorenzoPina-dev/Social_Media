import type { Knex } from 'knex';

/**
 * knexfile.ts — Auth Service
 *
 * Usato da: `knex migrate:latest`, `knex migrate:rollback`, ecc.
 * Per i test, DATABASE_URL è sovrascritta da process.env.TEST_DATABASE_URL
 * o dall'env impostata in tests/setup.ts.
 */

const config: Record<string, Knex.Config> = {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/social_media',
    pool: { min: 2, max: 10 },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './seeds',
    },
  },

  test: {
    client: 'postgresql',
    connection:
      process.env.TEST_DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5432/auth_test_db',
    pool: { min: 1, max: 5 },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
      extension: 'ts',
    },
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: { min: 5, max: 20 },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
      extension: 'ts',
    },
  },
};

export default config;
module.exports = config; // CommonJS compatibility for knex CLI
