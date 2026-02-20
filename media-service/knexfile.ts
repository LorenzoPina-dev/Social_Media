import { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/media_db',
    pool: { min: 2, max: 10 },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds',
    },
  },

  test: {
    client: 'postgresql',
    connection: process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/media_test_db',
    pool: { min: 2, max: 10 },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: { min: 5, max: 20 },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
  },
};

export default config;
module.exports = config;
