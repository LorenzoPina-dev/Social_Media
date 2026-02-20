/**
 * Session Model
 * Database operations for sessions table
 */

import { getDatabase } from '../config/database';
import { Session, CreateSessionDto } from '../types';

export class SessionModel {
  private readonly table = 'sessions';

  /**
   * Create new session
   */
  async create(data: CreateSessionDto): Promise<Session> {
    const db = getDatabase();
    const [session] = await db(this.table)
      .insert({
        ...data,
        created_at: new Date(),
        last_activity: new Date(),
      })
      .returning('*');

    return session;
  }

  /**
   * Find session by refresh token
   */
  async findByRefreshToken(refresh_token: string): Promise<Session | null> {
    const db = getDatabase();
    const session = await db(this.table)
      .where({ refresh_token })
      .where('expires_at', '>', new Date())
      .first();

    return session || null;
  }

  /**
   * Find sessions by user ID
   */
  async findByUserId(user_id: string): Promise<Session[]> {
    const db = getDatabase();
    const sessions = await db(this.table)
      .where({ user_id })
      .where('expires_at', '>', new Date())
      .orderBy('last_activity', 'desc');

    return sessions;
  }

  /**
   * Update last activity
   */
  async updateActivity(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .update({
        last_activity: new Date(),
      });
  }

  /**
   * Delete session
   */
  async delete(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .delete();
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllForUser(user_id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ user_id })
      .delete();
  }

  /**
   * Delete expired sessions
   */
  async deleteExpired(): Promise<number> {
    const db = getDatabase();
    const deleted = await db(this.table)
      .where('expires_at', '<', new Date())
      .delete();

    return deleted;
  }

  /**
   * Count active sessions for user
   */
  async countActiveForUser(user_id: string): Promise<number> {
    const db = getDatabase();
    const result = await db(this.table)
      .where({ user_id })
      .where('expires_at', '>', new Date())
      .count('* as count')
      .first();

    return parseInt(result?.count as string) || 0;
  }
}
