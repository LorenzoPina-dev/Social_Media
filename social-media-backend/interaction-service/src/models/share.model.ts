/**
 * Share Model — Data access for `shares` table
 */

import { getDatabase } from '../config/database';
import { Share, CreateShareDto } from '../types';

export class ShareModel {
  private readonly table = 'shares';

  async findByUserAndPost(userId: string, postId: string): Promise<Share | null> {
    const db = getDatabase();
    const share = await db(this.table).where({ user_id: userId, post_id: postId }).first();
    return share || null;
  }

  async create(data: CreateShareDto): Promise<Share> {
    const db = getDatabase();
    const [share] = await db(this.table)
      .insert({
        user_id: data.user_id,
        post_id: data.post_id,
        comment: data.comment || null,
        created_at: new Date(),
      })
      .returning('*');
    return share;
  }

  async countByPost(postId: string): Promise<number> {
    const db = getDatabase();
    const result = await db(this.table)
      .where({ post_id: postId })
      .count('id as count')
      .first();
    return parseInt(String(result?.count ?? 0), 10);
  }

  async deleteByPost(postId: string): Promise<void> {
    const db = getDatabase();
    await db(this.table).where({ post_id: postId }).delete();
  }

  async deleteByUser(userId: string): Promise<void> {
    const db = getDatabase();
    await db(this.table).where({ user_id: userId }).delete();
  }

  async findByPost(postId: string, limit = 20, cursor?: string): Promise<Share[]> {
    const db = getDatabase();
    let query = db(this.table)
      .where({ post_id: postId })
      .orderBy('created_at', 'desc')
      .limit(limit);

    if (cursor) {
      query = query.where('created_at', '<', new Date(cursor));
    }

    return query.select('*');
  }
}
