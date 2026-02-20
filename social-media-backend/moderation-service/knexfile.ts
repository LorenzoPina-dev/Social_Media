import type { Knex } from 'knex';
import { config } from './src/config';

const knexConfig: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: config.database.url,
    migrations: {
      directory: './migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './seeds',
    },
    pool: { min: 2, max: 10 },
  },

  test: {
    client: 'pg',
    connection:
      process.env.TEST_DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/moderation_test_db',
    migrations: {
      directory: './migrations',
      extension: 'ts',
    },
    pool: { min: 1, max: 5 },
  },

  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './migrations',
      extension: 'js',
    },
    pool: { min: 2, max: 20 },
  },
};

export default knexConfig;
module.exports = knexConfig;
