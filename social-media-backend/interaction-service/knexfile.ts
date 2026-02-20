import { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const config: { [env: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/interaction_db',
    pool: { min: 2, max: 10 },
    migrations: { directory: './migrations', tableName: 'knex_migrations', extension: 'ts' },
    seeds: { directory: './seeds', extension: 'ts' },
  },

  test: {
    client: 'postgresql',
    connection: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/interaction_test_db',
    pool: { min: 1, max: 5 },
    migrations: { directory: './migrations', tableName: 'knex_migrations', extension: 'ts' },
    seeds: { directory: './seeds', extension: 'ts' },
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: { min: 5, max: 20 },
    migrations: { directory: './migrations', tableName: 'knex_migrations', extension: 'ts' },
  },
};

module.exports = config;
