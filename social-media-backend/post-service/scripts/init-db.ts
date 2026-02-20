import { Client } from 'pg';

const DATABASES = ['post_db', 'post_test_db'];

async function init() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
  });

  await client.connect();

  for (const DB_NAME of DATABASES) {
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [DB_NAME]
    );

    if (result.rowCount === 0) {
      console.log(`Creating database ${DB_NAME}...`);
      await client.query(`CREATE DATABASE ${DB_NAME}`);
      console.log(`${DB_NAME} created`);
    } else {
      console.log(`${DB_NAME} already exists`);
    }
  }

  await client.end();
}

init().catch(console.error);
