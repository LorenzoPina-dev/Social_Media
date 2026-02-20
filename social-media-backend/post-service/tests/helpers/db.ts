// test/helpers/db.ts - Helper condiviso
import knex, { Knex } from 'knex';

let dbInstance: Knex | null = null;

export async function getTestDb() {
  if (!dbInstance) {
    dbInstance = knex({
      client: 'postgresql',
      connection: process.env.TEST_DATABASE_URL,
      pool: { min: 1, max: 1 }  // Importante: un solo client per test
    });
  }
  return dbInstance;
}

export async function resetDb(db: Knex) {
  // Usa transazioni per clean UP, non migrazioni!
  await db.raw(`
    TRUNCATE TABLE 
      post_edit_history, 
      post_hashtags, 
      hashtags, 
      posts 
    RESTART IDENTITY 
    CASCADE
  `);
}