/**
 * Password Reset Model
 * Database operations for password_reset_tokens table
 */

import { getDatabase } from '../config/database';
import { PasswordResetToken } from '../types';
import { randomBytes } from 'crypto';

export class PasswordResetModel {
  private readonly table = 'password_reset_tokens';

  /**
   * Create password reset token
   */
  async create(user_id: string, expiresInMinutes: number = 60): Promise<PasswordResetToken> {
    const db = getDatabase();
    
    // Generate secure token
    const token = randomBytes(32).toString('hex');
    
    const expires_at = new Date();
    expires_at.setMinutes(expires_at.getMinutes() + expiresInMinutes);

    const [resetToken] = await db(this.table)
      .insert({
        user_id,
        token,
        expires_at,
        used: false,
        created_at: new Date(),
      })
      .returning('*');

    return resetToken;
  }

  /**
   * Find valid token
   */
  async findByToken(token: string): Promise<PasswordResetToken | null> {
    const db = getDatabase();
    const resetToken = await db(this.table)
      .where({ token })
      .where('used', false)
      .where('expires_at', '>', new Date())
      .first();

    return resetToken || null;
  }

  /**
   * Mark token as used
   */
  async markAsUsed(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .update({ used: true });
  }

  /**
   * Delete all tokens for user
   */
  async deleteAllForUser(user_id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ user_id })
      .delete();
  }

  /**
   * Delete expired tokens
   */
  async deleteExpired(): Promise<number> {
    const db = getDatabase();
    const deleted = await db(this.table)
      .where('expires_at', '<', new Date())
      .orWhere('used', true)
      .delete();

    return deleted;
  }
}
