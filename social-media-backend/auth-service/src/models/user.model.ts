/**
 * User Model
 * Database operations for users table
 */

import { getDatabase } from '../config/database';
import { User, CreateUserDto } from '../types';
import argon2 from 'argon2';

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

    // Hash password
    const password_hash = await argon2.hash(data.password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    const [user] = await db(this.table)
      .insert({
        username: data.username,
        email: data.email,
        password_hash,
        display_name: data.display_name,
        verified: false,
        mfa_enabled: false,
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    return user;
  }

  /**
   * Update user
   */
  async update(id: string, data: Partial<User>): Promise<User> {
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
   * Verify password
   */
  async verifyPassword(user: User, password: string): Promise<boolean> {
    try {
      return await argon2.verify(user.password_hash, password);
    } catch (error) {
      return false;
    }
  }

  /**
   * Update password
   */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    const db = getDatabase();
    const password_hash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await db(this.table)
      .where({ id })
      .update({
        password_hash,
        updated_at: new Date(),
      });
  }

  /**
   * Enable MFA
   */
  async enableMFA(id: string, secret: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .update({
        mfa_enabled: true,
        mfa_secret: secret,
        updated_at: new Date(),
      });
  }

  /**
   * Disable MFA
   */
  async disableMFA(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .update({
        mfa_enabled: false,
        mfa_secret: null,
        updated_at: new Date(),
      });
  }

  /**
   * Mark user as verified
   */
  async markVerified(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .update({
        verified: true,
        updated_at: new Date(),
      });
  }

  /**
   * Suspend user
   */
  async suspend(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .update({
        status: 'SUSPENDED',
        updated_at: new Date(),
      });
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
        updated_at: new Date(),
      });
  }
}
