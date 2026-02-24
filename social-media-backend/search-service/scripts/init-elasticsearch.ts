/**
 * init-elasticsearch.ts
 * Verifica che gli indici Elasticsearch esistano e li crea se necessario.
 * Uso: npx ts-node scripts/init-elasticsearch.ts
 *
 * NOTA: search-service NON usa PostgreSQL. Usa Elasticsearch + Redis.
 * Questo script sostituisce il precedente init-db.ts (che erroneamente
 * puntava a PostgreSQL).
 */

import { Client } from '@elastic/elasticsearch';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ES_URL = process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200';
const PREFIX = process.env.ELASTICSEARCH_INDEX_PREFIX ?? '';

const INDICES = [
  {
    name: `${PREFIX}users`,
    body: {
      mappings: {
        properties: {
          id:             { type: 'keyword' as const },
          username:       { type: 'text' as const, analyzer: 'standard', fields: { keyword: { type: 'keyword' as const }, suggest: { type: 'completion' as const } } },
          display_name:   { type: 'text' as const, analyzer: 'standard', fields: { keyword: { type: 'keyword' as const } } },
          bio:            { type: 'text' as const, analyzer: 'standard' },
          avatar_url:     { type: 'keyword' as const, index: false },
          verified:       { type: 'boolean' as const },
          follower_count: { type: 'integer' as const },
          status:         { type: 'keyword' as const },
          created_at:     { type: 'date' as const },
        },
      },
      settings: { number_of_shards: 1, number_of_replicas: 0 },
    },
  },
  {
    name: `${PREFIX}posts`,
    body: {
      mappings: {
        properties: {
          id:                { type: 'keyword' as const },
          user_id:           { type: 'keyword' as const },
          content:           { type: 'text' as const, analyzer: 'standard', fields: { keyword: { type: 'keyword' as const } } },
          hashtags:          { type: 'keyword' as const },
          visibility:        { type: 'keyword' as const },
          like_count:        { type: 'integer' as const },
          comment_count:     { type: 'integer' as const },
          moderation_status: { type: 'keyword' as const },
          created_at:        { type: 'date' as const },
        },
      },
      settings: { number_of_shards: 1, number_of_replicas: 0 },
    },
  },
  {
    name: `${PREFIX}hashtags`,
    body: {
      mappings: {
        properties: {
          tag:        { type: 'keyword' as const },
          post_count: { type: 'integer' as const },
          suggest:    { type: 'completion' as const, analyzer: 'simple', max_input_length: 50 },
        },
      },
      settings: { number_of_shards: 1, number_of_replicas: 0 },
    },
  },
];

async function initElasticsearch(): Promise<void> {
  const client = new Client({ node: ES_URL });

  console.log(`🔗 Connecting to Elasticsearch at ${ES_URL}...`);

  try {
    const health = await client.cluster.health({});
    console.log(`✅ Elasticsearch connected — cluster status: ${health.status}`);
  } catch (err) {
    console.error('❌ Cannot connect to Elasticsearch:', err);
    process.exit(1);
  }

  for (const { name, body } of INDICES) {
    try {
      const exists = await client.indices.exists({ index: name });
      if (exists) {
        console.log(`ℹ️  Index "${name}" already exists — skipping`);
      } else {
        await client.indices.create({ index: name, ...body });
        console.log(`✅ Index "${name}" created`);
      }
    } catch (err) {
      console.error(`❌ Failed to create index "${name}":`, err);
    }
  }

  await client.close();
  console.log('🎉 Elasticsearch initialization complete');
}

initElasticsearch().catch((err) => {
  console.error('Fatal error during init:', err);
  process.exit(1);
});
