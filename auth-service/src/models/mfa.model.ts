/**
 * MFA Model
 * Database operations for MFA secrets and backup codes
 */

import { getDatabase } from '../config/database';
import { MFASecret } from '../types';
import { randomBytes } from 'crypto';

export class MFAModel {
  private readonly table = 'mfa_secrets';

  /**
   * Create MFA secret for user
   */
  async create(userId: string, secret: string): Promise<MFASecret> {
    const db = getDatabase();

    // Generate 10 backup codes
    const backupCodes = this.generateBackupCodes(10);

    const [mfaSecret] = await db(this.table)
      .insert({
        user_id: userId,
        secret,
        backup_codes: JSON.stringify(backupCodes),
        created_at: new Date(),
      })
      .returning('*');

    return {
      ...mfaSecret,
      backup_codes: backupCodes,
    };
  }

  /**
   * Find MFA secret by user ID
   */
  async findByUserId(userId: string): Promise<MFASecret | null> {
    const db = getDatabase();
    const secret = await db(this.table)
      .where({ user_id: userId })
      .first();

    if (!secret) {
      return null;
    }

    return {
      ...secret,
      backup_codes: JSON.parse(secret.backup_codes || '[]'),
    };
  }

  /**
   * Verify MFA secret (mark as verified)
   */
  async verify(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .update({
        verified_at: new Date(),
      });
  }

  /**
   * Use backup code
   */
  async useBackupCode(userId: string, code: string): Promise<boolean> {
    const db = getDatabase();
    const secret = await this.findByUserId(userId);

    if (!secret) {
      return false;
    }

    const backupCodes = secret.backup_codes;
    const codeIndex = backupCodes.indexOf(code);

    if (codeIndex === -1) {
      return false;
    }

    // Remove used code
    backupCodes.splice(codeIndex, 1);

    // Update database
    await db(this.table)
      .where({ user_id: userId })
      .update({
        backup_codes: JSON.stringify(backupCodes),
      });

    return true;
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const db = getDatabase();
    const backupCodes = this.generateBackupCodes(10);

    await db(this.table)
      .where({ user_id: userId })
      .update({
        backup_codes: JSON.stringify(backupCodes),
      });

    return backupCodes;
  }

  /**
   * Delete MFA secret for user
   */
  async delete(userId: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ user_id: userId })
      .delete();
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}
