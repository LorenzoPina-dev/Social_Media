import knex, { Knex } from 'knex';
import { closeRedis } from '../src/config/redis';
import { disconnectKafka } from '../src/config/kafka';

let testDb: Knex;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  const dbUrl =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/moderation_test_db';

  testDb = knex({
    client: 'pg',
    connection: dbUrl,
    migrations: { directory: './migrations', extension: 'ts' },
  });

  await testDb.migrate.latest();
});

afterAll(async () => {
  if (testDb) {
    await testDb.migrate.rollback(undefined, true);
    await testDb.destroy();
  }
  await closeRedis();
  await disconnectKafka();
});

beforeEach(async () => {
  if (testDb) {
    // Truncate in reverse FK order
    await testDb.raw('TRUNCATE appeals, moderation_decisions, moderation_cases CASCADE');
  }
});
