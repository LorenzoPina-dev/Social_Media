/**
 * Like Model — Data access for `likes` table
 */

import { getDatabase } from '../config/database';
import { Like, CreateLikeDto, LikeTargetType } from '../types';

export class LikeModel {
  private readonly table = 'likes';

  async findByUserAndTarget(userId: string, targetId: string, targetType: LikeTargetType): Promise<Like | null> {
    const db = getDatabase();
    const like = await db(this.table)
      .where({ user_id: userId, target_id: targetId, target_type: targetType })
      .first();
    return like || null;
  }

  async create(data: CreateLikeDto): Promise<Like> {
    const db = getDatabase();
    const [like] = await db(this.table)
      .insert({
        user_id: data.user_id,
        target_id: data.target_id,
        target_type: data.target_type,
        created_at: new Date(),
      })
      .returning('*');
    return like;
  }

  async delete(userId: string, targetId: string, targetType: LikeTargetType): Promise<boolean> {
    const db = getDatabase();
    const count = await db(this.table)
      .where({ user_id: userId, target_id: targetId, target_type: targetType })
      .delete();
    return count > 0;
  }

  async countByTarget(targetId: string, targetType: LikeTargetType): Promise<number> {
    const db = getDatabase();
    const result = await db(this.table)
      .where({ target_id: targetId, target_type: targetType })
      .count('id as count')
      .first();
    return parseInt(String(result?.count ?? 0), 10);
  }

  async getUserLikedPosts(userId: string, postIds: string[]): Promise<string[]> {
    const db = getDatabase();
    const rows = await db(this.table)
      .where({ user_id: userId, target_type: 'POST' })
      .whereIn('target_id', postIds)
      .select('target_id');
    return rows.map((r: { target_id: string }) => r.target_id);
  }

  async deleteByTarget(targetId: string, targetType: LikeTargetType): Promise<void> {
    const db = getDatabase();
    await db(this.table).where({ target_id: targetId, target_type: targetType }).delete();
  }

  async deleteByUser(userId: string): Promise<void> {
    const db = getDatabase();
    await db(this.table).where({ user_id: userId }).delete();
  }

  async getByTarget(
    targetId: string,
    targetType: LikeTargetType,
    limit = 20,
    cursor?: string
  ): Promise<Like[]> {
    const db = getDatabase();
    let query = db(this.table)
      .where({ target_id: targetId, target_type: targetType })
      .orderBy('created_at', 'desc')
      .limit(limit);

    if (cursor) {
      query = query.where('created_at', '<', new Date(cursor));
    }

    return query.select('*');
  }
}
