import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('moderation_decisions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('case_id').notNullable().references('id').inTable('moderation_cases').onDelete('CASCADE');
    table.string('decision', 15).notNullable(); // APPROVED | REJECTED | ESCALATED
    table.text('reason').nullable();
    table.uuid('decided_by').nullable(); // NULL = automated decision
    table.timestamp('decided_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw('CREATE INDEX idx_decisions_case_id ON moderation_decisions(case_id)');
  await knex.raw('CREATE INDEX idx_decisions_decided_at ON moderation_decisions(decided_at DESC)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('moderation_decisions');
}
