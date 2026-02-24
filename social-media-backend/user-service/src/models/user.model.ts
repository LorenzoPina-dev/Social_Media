/**
 * User Model
 * Database operations for users table
 */

import { getDatabase } from '../config/database';
import { User, CreateUserDto, UpdateUserDto } from '../types';

export class UserModel {
  private readonly table = 'users';

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const db = getDatabase();
    const user = await db(this.table)
      .where({ id })
      .whereNull('deleted_at')
      .first();

    return user || null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const db = getDatabase();
    const user = await db(this.table)
      .where({ email })
      .whereNull('deleted_at')
      .first();

    return user || null;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const db = getDatabase();
    const user = await db(this.table)
      .where({ username })
      .whereNull('deleted_at')
      .first();

    return user || null;
  }

  /**
   * Create new user
   */
  async create(data: CreateUserDto): Promise<User> {
    const db = getDatabase();
    const [user] = await db(this.table)
      .insert({
        ...data,
        follower_count: 0,
        following_count: 0,
        verified: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    return user;
  }

  /**
   * Update user
   */
  async update(id: string, data: UpdateUserDto): Promise<User> {
    const db = getDatabase();
    const [user] = await db(this.table)
      .where({ id })
      .update({
        ...data,
        updated_at: new Date(),
      })
      .returning('*');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Soft delete user
   */
  async softDelete(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .update({
        deleted_at: new Date(),
        status: 'PENDING_DELETION',
      });
  }

  /**
   * Hard delete user (after grace period)
   */
  async hardDelete(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .delete();
  }

  /**
   * Search users by query
   */
  async search(
    query: string,
    options: {
      verified?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<User[]> {
    const db = getDatabase();
    let queryBuilder = db(this.table)
      .whereNull('deleted_at')
      .where(function () {
        this.where('username', 'ilike', `%${query}%`)
          .orWhere('display_name', 'ilike', `%${query}%`);
      });

    if (options.verified !== undefined) {
      queryBuilder = queryBuilder.where('verified', options.verified);
    }

    const users = await queryBuilder
      .orderBy('follower_count', 'desc')
      .limit(options.limit || 20)
      .offset(options.offset || 0);

    return users;
  }

  /**
   * Get users by IDs
   */
  async findByIds(ids: string[]): Promise<User[]> {
    const db = getDatabase();
    const users = await db(this.table)
      .whereIn('id', ids)
      .whereNull('deleted_at');

    return users;
  }

  /**
   * Get suggested users ordered by follower count
   */
  async getSuggested(
    limit: number = 10,
    excludeUserId?: string
  ): Promise<User[]> {
    const db = getDatabase();
    let query = db(`${this.table} as u`)
      .select('u.*')
      .whereNull('deleted_at')
      .where('status', 'ACTIVE')
      .orderBy('follower_count', 'desc')
      .limit(limit);

    if (excludeUserId) {
      query = query
        .whereNot('u.id', excludeUserId)
        .whereNotExists(
          db('followers as f')
            .select(db.raw('1'))
            .where('f.follower_id', excludeUserId)
            .whereRaw('f.following_id = u.id')
        );
    }

    return query;
  }

  /**
   * Increment follower count
   */
  async incrementFollowerCount(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .increment('follower_count', 1);
  }

  /**
   * Decrement follower count
   */
  async decrementFollowerCount(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .where('follower_count', '>', 0)
      .decrement('follower_count', 1);
  }

  /**
   * Increment following count
   */
  async incrementFollowingCount(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .increment('following_count', 1);
  }

  /**
   * Decrement following count
   */
  async decrementFollowingCount(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .where('following_count', '>', 0)
      .decrement('following_count', 1);
  }
}
