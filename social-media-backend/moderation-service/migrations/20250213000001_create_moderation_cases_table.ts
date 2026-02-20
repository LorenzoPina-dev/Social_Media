import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('moderation_cases', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('entity_id').notNullable();
    table.string('entity_type', 10).notNullable();   // POST | COMMENT | MEDIA
    table.string('reason', 20).notNullable();         // AUTO_FLAGGED | USER_REPORT | ADMIN
    table.string('status', 15).notNullable().defaultTo('PENDING'); // PENDING | IN_REVIEW | RESOLVED
    table.float('ml_score').nullable();
    table.jsonb('ml_categories').nullable();
    table.uuid('assigned_to').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('resolved_at', { useTz: true }).nullable();
  });

  await knex.raw('CREATE INDEX idx_cases_entity ON moderation_cases(entity_id)');
  await knex.raw('CREATE INDEX idx_cases_status ON moderation_cases(status)');
  await knex.raw('CREATE INDEX idx_cases_assigned ON moderation_cases(assigned_to) WHERE assigned_to IS NOT NULL');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('moderation_cases');
}
