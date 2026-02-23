/**
 * Setup Elasticsearch Indices
 * Crea i 3 indici (users, posts, hashtags) al boot se non esistono.
 * Chiamato da app.ts DOPO connectElasticsearch().
 */

import { Client } from '@elastic/elasticsearch';
import { logger } from './logger';
import { config } from '../config';

// ── Index name helpers ────────────────────────────────────────────────────────

const prefix = config.ELASTICSEARCH_INDEX_PREFIX;
export const INDEX = {
  USERS:    `${prefix}users`,
  POSTS:    `${prefix}posts`,
  HASHTAGS: `${prefix}hashtags`,
} as const;

// ── Mappings ──────────────────────────────────────────────────────────────────

const usersMapping = {
  mappings: {
    properties: {
      id:             { type: 'keyword' as const },
      username: {
        type: 'text' as const,
        analyzer: 'standard',
        fields: { keyword: { type: 'keyword' as const }, suggest: { type: 'completion' as const } },
      },
      display_name: {
        type: 'text' as const,
        analyzer: 'standard',
        fields: { keyword: { type: 'keyword' as const } },
      },
      bio:            { type: 'text' as const, analyzer: 'standard' },
      avatar_url:     { type: 'keyword' as const, index: false },
      verified:       { type: 'boolean' as const },
      follower_count: { type: 'integer' as const },
      status:         { type: 'keyword' as const },
      created_at:     { type: 'date' as const },
    },
  },
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },
};

const postsMapping = {
  mappings: {
    properties: {
      id:               { type: 'keyword' as const },
      user_id:          { type: 'keyword' as const },
      content: {
        type: 'text' as const,
        analyzer: 'standard',
        fields: { keyword: { type: 'keyword' as const } },
      },
      hashtags:         { type: 'keyword' as const },
      visibility:       { type: 'keyword' as const },
      like_count:       { type: 'integer' as const },
      comment_count:    { type: 'integer' as const },
      moderation_status:{ type: 'keyword' as const },
      created_at:       { type: 'date' as const },
    },
  },
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },
};

const hashtagsMapping = {
  mappings: {
    properties: {
      tag:        { type: 'keyword' as const },
      post_count: { type: 'integer' as const },
      suggest: {
        type: 'completion' as const,
        analyzer: 'simple',
        preserve_separators: true,
        preserve_position_increments: true,
        max_input_length: 50,
      },
    },
  },
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },
};

// ── Setup function ────────────────────────────────────────────────────────────

export async function setupElasticsearchIndices(client: Client): Promise<void> {
  const indices = [
    { name: INDEX.USERS,    body: usersMapping },
    { name: INDEX.POSTS,    body: postsMapping },
    { name: INDEX.HASHTAGS, body: hashtagsMapping },
  ];

  for (const { name, body } of indices) {
    try {
      const exists = await client.indices.exists({ index: name });
      if (!exists) {
        await client.indices.create({ index: name, ...body });
        logger.info(`✅ Elasticsearch index created: ${name}`);
      } else {
        logger.debug(`Elasticsearch index already exists: ${name}`);
      }
    } catch (error) {
      logger.error(`Failed to create Elasticsearch index: ${name}`, { error });
      throw error;
    }
  }
}
