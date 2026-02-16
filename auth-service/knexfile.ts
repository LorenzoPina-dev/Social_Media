/**
 * Knex Configuration for Migrations
 */

import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/social_media',
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      tableName: 'knex_migrations',
      extension: 'ts',
    },
    seeds: {
      directory: path.join(__dirname, 'seeds'),
      extension: 'ts',
    },
  },

  test: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/social_media_test',
    pool: {
      min: 1,
      max: 5,
    },
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      tableName: 'knex_migrations',
      extension: 'ts',
    },
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 5,
      max: 20,
    },
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      tableName: 'knex_migrations',
      extension: 'ts',
    },
  },
};

export default config;
