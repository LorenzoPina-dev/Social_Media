import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('appeals', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('case_id').notNullable().references('id').inTable('moderation_cases').onDelete('CASCADE');
    table.uuid('user_id').notNullable();
    table.text('reason').notNullable();
    table.string('status', 10).notNullable().defaultTo('PENDING'); // PENDING | GRANTED | DENIED
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('resolved_at', { useTz: true }).nullable();
  });

  await knex.raw('CREATE INDEX idx_appeals_case_id ON appeals(case_id)');
  await knex.raw('CREATE INDEX idx_appeals_user_id ON appeals(user_id)');
  await knex.raw('CREATE INDEX idx_appeals_status ON appeals(status)');
  // Prevent duplicate pending appeals per user per case
  await knex.raw(
    `CREATE UNIQUE INDEX idx_appeals_user_case_pending ON appeals(user_id, case_id) WHERE status = 'PENDING'`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('appeals');
}
