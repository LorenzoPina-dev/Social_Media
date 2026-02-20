import { Knex } from 'knex';

/**
 * Migration: create posts table — post-service / post_db
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('posts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();                     // no FK cross-DB
    table.text('content').notNullable();
    table.specificType('media_urls', 'TEXT[]').nullable();
    table.specificType('media_types', 'TEXT[]').nullable();
    table
      .string('visibility', 20)
      .notNullable()
      .defaultTo('PUBLIC')
      .checkIn(['PUBLIC', 'FOLLOWERS', 'PRIVATE'], 'chk_posts_visibility');
    table.integer('like_count').notNullable().defaultTo(0);
    table.integer('comment_count').notNullable().defaultTo(0);
    table.integer('share_count').notNullable().defaultTo(0);
    table
      .string('moderation_status', 20)
      .notNullable()
      .defaultTo('PENDING')
      .checkIn(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'], 'chk_posts_mod_status');
    table.boolean('is_scheduled').notNullable().defaultTo(false);
    table.timestamp('scheduled_at', { useTz: true }).nullable();
    table.timestamp('published_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });

  await knex.raw('CREATE INDEX idx_posts_user_created ON posts(user_id, created_at DESC)');
  await knex.raw('CREATE INDEX idx_posts_created ON posts(created_at DESC)');
  await knex.raw('CREATE INDEX idx_posts_moderation ON posts(moderation_status)');
  await knex.raw(
    'CREATE INDEX idx_posts_scheduled ON posts(is_scheduled, scheduled_at) WHERE is_scheduled = true',
  );
  await knex.raw(
    'CREATE INDEX idx_posts_deleted_at ON posts(deleted_at) WHERE deleted_at IS NOT NULL',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('posts');
}
