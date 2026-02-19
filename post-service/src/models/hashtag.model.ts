/**
 * Hashtag Model — Data Access Layer
 */

import { getDatabase } from '../config/database';
import { Hashtag } from '../types';

export class HashtagModel {
  private readonly hashtagsTable = 'hashtags';
  private readonly postHashtagsTable = 'post_hashtags';

  /** Upsert molti hashtag (INSERT OR UPDATE post_count) */
  async upsertMany(tags: string[]): Promise<Hashtag[]> {
    if (tags.length === 0) return [];
    const db = getDatabase();

    const inserted: Hashtag[] = [];
    for (const tag of tags) {
      const existing = await db(this.hashtagsTable).where({ tag }).first();
      if (existing) {
        await db(this.hashtagsTable).where({ tag }).increment('post_count', 1);
        inserted.push({ ...existing, post_count: existing.post_count + 1 });
      } else {
        const [created] = await db(this.hashtagsTable)
          .insert({ tag, post_count: 1, created_at: new Date() })
          .returning('*');
        inserted.push(created as Hashtag);
      }
    }
    return inserted;
  }

  /** Decrementa post_count per i tag di un post cancellato */
  async decrementForPost(postId: string): Promise<void> {
    const db = getDatabase();
    const links = await db(this.postHashtagsTable).where({ post_id: postId });
    for (const link of links) {
      await db(this.hashtagsTable)
        .where({ id: link.hashtag_id })
        .where('post_count', '>', 0)
        .decrement('post_count', 1);
    }
  }

  /** Collega gli hashtag a un post */
  async linkToPost(postId: string, hashtagIds: string[]): Promise<void> {
    if (hashtagIds.length === 0) return;
    const db = getDatabase();
    const rows = hashtagIds.map((hid) => ({ post_id: postId, hashtag_id: hid }));
    await db(this.postHashtagsTable).insert(rows).onConflict(['post_id', 'hashtag_id']).ignore();
  }

  /** Rimuove tutti i link hashtag per un post */
  async unlinkFromPost(postId: string): Promise<void> {
    const db = getDatabase();
    await db(this.postHashtagsTable).where({ post_id: postId }).delete();
  }

  /** Trending hashtag — top N per post_count */
  async getTrending(limit = 10): Promise<Hashtag[]> {
    const db = getDatabase();
    return db(this.hashtagsTable)
      .where('post_count', '>', 0)
      .orderBy('post_count', 'desc')
      .limit(limit)
      .select('*') as unknown as Hashtag[];
  }

  /** Trova hashtag per tag */
  async findByTag(tag: string): Promise<Hashtag | null> {
    const db = getDatabase();
    const row = await db(this.hashtagsTable).where({ tag }).first();
    return row || null;
  }

  /** Ottieni gli ID degli hashtag collegati a un post */
  async getHashtagIdsForPost(postId: string): Promise<string[]> {
    const db = getDatabase();
    const rows = await db(this.postHashtagsTable).where({ post_id: postId }).select('hashtag_id');
    return rows.map((r: { hashtag_id: string }) => r.hashtag_id);
  }
}
