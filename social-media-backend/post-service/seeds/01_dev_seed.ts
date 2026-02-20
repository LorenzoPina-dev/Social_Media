/**
 * Development Seed — post-service
 *
 * Popola il database con dati di sviluppo realistici.
 * Esegui: npx knex seed:run --knexfile knexfile.ts
 */

import { Knex } from 'knex';

// Questi UUID devono corrispondere agli utenti creati in user-service seeds
const SEED_USERS = [
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000003',
];

const SEED_POSTS = [
  {
    id: 'cccccccc-0000-0000-0000-000000000001',
    user_id: SEED_USERS[0],
    content: 'Welcome to our social platform! #launch #newfeature',
    visibility: 'PUBLIC',
    moderation_status: 'APPROVED',
    like_count: 42,
    comment_count: 7,
    share_count: 3,
    is_scheduled: false,
    published_at: new Date('2025-02-01T10:00:00Z'),
    created_at: new Date('2025-02-01T10:00:00Z'),
    updated_at: new Date('2025-02-01T10:00:00Z'),
  },
  {
    id: 'cccccccc-0000-0000-0000-000000000002',
    user_id: SEED_USERS[0],
    content: 'TypeScript is amazing for large codebases. #typescript #nodejs #programming',
    visibility: 'PUBLIC',
    moderation_status: 'APPROVED',
    like_count: 128,
    comment_count: 24,
    share_count: 15,
    is_scheduled: false,
    published_at: new Date('2025-02-05T14:30:00Z'),
    created_at: new Date('2025-02-05T14:30:00Z'),
    updated_at: new Date('2025-02-05T14:30:00Z'),
  },
  {
    id: 'cccccccc-0000-0000-0000-000000000003',
    user_id: SEED_USERS[1],
    content: 'Building microservices with Kafka is great for decoupling. #kafka #microservices #architecture',
    visibility: 'PUBLIC',
    moderation_status: 'APPROVED',
    like_count: 76,
    comment_count: 12,
    share_count: 8,
    is_scheduled: false,
    published_at: new Date('2025-02-07T09:15:00Z'),
    created_at: new Date('2025-02-07T09:15:00Z'),
    updated_at: new Date('2025-02-07T09:15:00Z'),
  },
  {
    id: 'cccccccc-0000-0000-0000-000000000004',
    user_id: SEED_USERS[1],
    content: 'My private thoughts on distributed systems.',
    visibility: 'PRIVATE',
    moderation_status: 'APPROVED',
    like_count: 0,
    comment_count: 0,
    share_count: 0,
    is_scheduled: false,
    published_at: new Date('2025-02-08T11:00:00Z'),
    created_at: new Date('2025-02-08T11:00:00Z'),
    updated_at: new Date('2025-02-08T11:00:00Z'),
  },
  {
    id: 'cccccccc-0000-0000-0000-000000000005',
    user_id: SEED_USERS[2],
    content: 'Redis for caching is a game changer. #redis #performance #caching',
    visibility: 'PUBLIC',
    moderation_status: 'APPROVED',
    like_count: 55,
    comment_count: 9,
    share_count: 4,
    is_scheduled: false,
    published_at: new Date('2025-02-10T16:45:00Z'),
    created_at: new Date('2025-02-10T16:45:00Z'),
    updated_at: new Date('2025-02-10T16:45:00Z'),
  },
];

const SEED_HASHTAGS = [
  { tag: 'typescript', post_count: 2 },
  { tag: 'nodejs', post_count: 1 },
  { tag: 'programming', post_count: 1 },
  { tag: 'kafka', post_count: 1 },
  { tag: 'microservices', post_count: 1 },
  { tag: 'architecture', post_count: 1 },
  { tag: 'redis', post_count: 1 },
  { tag: 'performance', post_count: 1 },
  { tag: 'caching', post_count: 1 },
  { tag: 'launch', post_count: 1 },
  { tag: 'newfeature', post_count: 1 },
];

export async function seed(knex: Knex): Promise<void> {
  // Clean existing data (respect FK order)
  await knex('post_edit_history').del();
  await knex('post_hashtags').del();
  await knex('hashtags').del();
  await knex('posts').del();

  // Insert posts
  await knex('posts').insert(SEED_POSTS);

  // Insert hashtags and get their IDs
  const hashtagRows = await knex('hashtags')
    .insert(
      SEED_HASHTAGS.map((h) => ({
        ...h,
        created_at: new Date(),
      })),
    )
    .returning(['id', 'tag']);

  // Build tag → id map
  const tagIdMap = new Map(hashtagRows.map((h: { id: string; tag: string }) => [h.tag, h.id]));

  // Link post_hashtags
  const postHashtags: { post_id: string; hashtag_id: string }[] = [];

  const postTagLinks: Record<string, string[]> = {
    'cccccccc-0000-0000-0000-000000000001': ['launch', 'newfeature'],
    'cccccccc-0000-0000-0000-000000000002': ['typescript', 'nodejs', 'programming'],
    'cccccccc-0000-0000-0000-000000000003': ['kafka', 'microservices', 'architecture'],
    'cccccccc-0000-0000-0000-000000000005': ['redis', 'performance', 'caching'],
  };

  for (const [postId, tags] of Object.entries(postTagLinks)) {
    for (const tag of tags) {
      const hashtagId = tagIdMap.get(tag);
      if (hashtagId) {
        postHashtags.push({ post_id: postId, hashtag_id: hashtagId });
      }
    }
  }

  if (postHashtags.length > 0) {
    await knex('post_hashtags').insert(postHashtags);
  }

  // Add an edit history entry for demo purposes
  await knex('post_edit_history').insert({
    post_id: 'cccccccc-0000-0000-0000-000000000002',
    previous_content: 'TypeScript is great for large projects! #typescript #programming',
    edited_at: new Date('2025-02-05T15:00:00Z'),
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Seeded ${SEED_POSTS.length} posts, ${SEED_HASHTAGS.length} hashtags`);
}
