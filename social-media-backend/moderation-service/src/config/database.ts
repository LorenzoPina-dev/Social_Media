import knex, { Knex } from 'knex';
import { config } from './index';

let db: Knex | null = null;

export function getDatabase(): Knex {
  if (!db) {
    db = knex({
      client: 'pg',
      connection: config.database.url,
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
      },
      searchPath: ['public'],
      debug: config.env === 'development',
    });
  }
  return db;
}

export async function connectDatabase(): Promise<Knex> {
  const database = getDatabase();
  await database.raw('SELECT 1');
  return database;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}
