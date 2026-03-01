/**
 * Follower Model
 * Database operations for follower relationships
 */

import { getDatabase } from '../config/database';
import { Follower } from '../types';

export class FollowerModel {
  private readonly table = 'followers';

  /**
   * Create follow relationship
   */
  async create(followerId: string, followingId: string): Promise<Follower> {
    const db = getDatabase();
    const [follower] = await db(this.table)
      .insert({
        follower_id: followerId,
        following_id: followingId,
        created_at: new Date(),
      })
      .returning('*');

    return follower;
  }

  /**
   * Delete follow relationship
   */
  async delete(followerId: string, followingId: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({
        follower_id: followerId,
        following_id: followingId,
      })
      .delete();
  }

  /**
   * Check if user follows another user
   */
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const db = getDatabase();
    const result = await db(this.table)
      .where({
        follower_id: followerId,
        following_id: followingId,
      })
      .first();

    return !!result;
  }

  /**
   * Get user's followers (returns user IDs)
   */
  async getFollowers(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<string[]> {
    const db = getDatabase();
    const followers = await db(this.table)
      .where({ following_id: userId })
      .select('follower_id')
      .limit(options.limit || 20)
      .offset(options.offset || 0)
      .orderBy('created_at', 'desc');

    return followers.map(f => f.follower_id);
  }

  /**
   * Get users that a user is following (returns user IDs)
   */
  async getFollowing(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<string[]> {
    const db = getDatabase();
    const following = await db(this.table)
      .where({ follower_id: userId })
      .select('following_id')
      .limit(options.limit || 20)
      .offset(options.offset || 0)
      .orderBy('created_at', 'desc');

    return following.map(f => f.following_id);
  }

  /**
   * Get follower count
   */
  async getFollowerCount(userId: string): Promise<number> {
    const db = getDatabase();
    const result = await db(this.table)
      .where({ following_id: userId })
      .count('* as count')
      .first();

    return parseInt(result?.count as string) || 0;
  }

  /**
   * Get following count
   */
  async getFollowingCount(userId: string): Promise<number> {
    const db = getDatabase();
    const result = await db(this.table)
      .where({ follower_id: userId })
      .count('* as count')
      .first();

    return parseInt(result?.count as string) || 0;
  }

  /**
   * Delete all followers for a user
   */
  async deleteAllFollowers(userId: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ following_id: userId })
      .delete();
  }

  /**
   * Delete all following for a user
   */
  async deleteAllFollowing(userId: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ follower_id: userId })
      .delete();
  }

  /**
   * Get mutual followers (users who follow each other)
   */
  async getMutualFollowers(userId: string): Promise<string[]> {
    const db = getDatabase();
    
    // Find users where both follow each other
    const mutual = await db(this.table as any)
      .select('f1.following_id as user_id')
      .from(`${this.table} as f1`)
      .innerJoin(
        `${this.table} as f2`,
        function() {
          this.on('f1.following_id', '=', 'f2.follower_id')
            .andOn('f1.follower_id', '=', 'f2.following_id');
        }
      )
      .where('f1.follower_id', userId);

    return mutual.map(m => m.user_id);
  }

  /**
   * Check if two users follow each other (mutual follow)
   */
  async areMutualFollowers(userId1: string, userId2: string): Promise<boolean> {
    const follows1 = await this.isFollowing(userId1, userId2);
    const follows2 = await this.isFollowing(userId2, userId1);
    return follows1 && follows2;
  }

  /**
   * Get ALL follower IDs for a user — no pagination, used for fan-out.
   */
  async getAllFollowerIds(userId: string): Promise<string[]> {
    const db = getDatabase();
    const rows = await db(this.table)
      .where({ following_id: userId })
      .select('follower_id')
      .orderBy('created_at', 'desc');
    return rows.map((r: { follower_id: string }) => r.follower_id);
  }

  /**
   * Get follower relationship details
   */
  async getRelationship(followerId: string, followingId: string): Promise<Follower | null> {
    const db = getDatabase();
    const relationship = await db(this.table)
      .where({
        follower_id: followerId,
        following_id: followingId,
      })
      .first();

    return relationship || null;
  }
}
