import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('recipient_id').notNullable();
    table.uuid('actor_id').nullable();
    table.string('type', 20).notNullable();       // LIKE | COMMENT | FOLLOW | MENTION | SHARE | SYSTEM
    table.uuid('entity_id').nullable();
    table.string('entity_type', 20).nullable();   // POST | COMMENT | USER
    table.string('title', 255).notNullable();
    table.text('body').notNullable();
    table.boolean('read').notNullable().defaultTo(false);
    table.timestamp('read_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE INDEX idx_notif_recipient_unread
      ON notifications(recipient_id, read, created_at DESC)
  `);
  await knex.raw(`
    CREATE INDEX idx_notif_recipient_created
      ON notifications(recipient_id, created_at DESC)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
}
