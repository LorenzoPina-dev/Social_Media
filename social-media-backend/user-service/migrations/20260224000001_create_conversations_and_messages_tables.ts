import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('conversations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('participant_a_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('participant_b_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['participant_a_id', 'participant_b_id'], {
      indexName: 'uq_conversations_participants',
    });
  });

  await knex.schema.raw(
    'ALTER TABLE conversations ADD CONSTRAINT chk_conversations_distinct_participants CHECK (participant_a_id <> participant_b_id)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_conversations_participant_a ON conversations(participant_a_id)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_conversations_participant_b ON conversations(participant_b_id)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC)'
  );

  await knex.schema.createTable('messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('conversation_id')
      .notNullable()
      .references('id')
      .inTable('conversations')
      .onDelete('CASCADE');
    table
      .uuid('sender_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.text('content').notNullable();
    table.timestamp('read_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.raw(
    'CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC)'
  );
  await knex.schema.raw(
    'CREATE INDEX idx_messages_conversation_unread ON messages(conversation_id, read_at)'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('conversations');
}
