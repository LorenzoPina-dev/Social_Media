/**
 * MFA Service
 * Business logic for Multi-Factor Authentication (TOTP)
 */

import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { MFAModel } from '../models/mfa.model';
import { UserModel } from '../models/user.model';
import { AuthProducer } from '../kafka/producers/auth.producer';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { MFASetupResponse, VerifyMFADto, ValidationError, MFAEnabledEvent } from '../types';

export class MFAService {
  constructor(
    private mfaModel: MFAModel,
    private userModel: UserModel,
    private authProducer: AuthProducer
  ) {}

  /**
   * Setup MFA for user
   * Generates secret and QR code
   */
  async setupMFA(userId: string): Promise<MFASetupResponse> {
    try {
      logger.info('Setting up MFA', { userId });

      // Check if user exists
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new ValidationError('User not found');
      }

      // Check if MFA already enabled
      if (user.mfa_enabled) {
        throw new ValidationError('MFA already enabled for this user');
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `Social Media (${user.username})`,
        issuer: 'Social Media Platform',
        length: 32,
      });

      // Save to database (not verified yet)
      const mfaSecret = await this.mfaModel.create(userId, secret.base32);

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

      logger.info('MFA setup initiated', { userId });
      metrics.incrementCounter('mfa_setup_initiated');

      return {
        secret: secret.base32,
        qr_code: qrCode,
        backup_codes: mfaSecret.backup_codes,
      };
    } catch (error) {
      logger.error('MFA setup failed', { userId, error });
      throw error;
    }
  }

  /**
   * Verify MFA token and enable MFA
   */
  async verifyAndEnableMFA(userId: string, data: VerifyMFADto): Promise<{ success: boolean; backup_codes: string[] }> {
    try {
      logger.info('Verifying MFA token', { userId });

      // Get MFA secret
      const mfaSecret = await this.mfaModel.findByUserId(userId);
      if (!mfaSecret) {
        throw new ValidationError('MFA not set up for this user');
      }

      // Verify token
      const verified = speakeasy.totp.verify({
        secret: mfaSecret.secret,
        encoding: 'base32',
        token: data.code,
        window: 1, // Allow 1 step before/after
      });

      if (!verified) {
        logger.warn('Invalid MFA token', { userId });
        metrics.incrementCounter('mfa_verification_failed');
        throw new ValidationError('Invalid MFA code');
      }

      // Mark secret as verified
      await this.mfaModel.verify(mfaSecret.id);

      // Enable MFA for user
      await this.userModel.enableMFA(userId, mfaSecret.secret);

      // Publish event
      const event: MFAEnabledEvent = {
        type: 'mfa_enabled',
        userId,
        timestamp: new Date(),
      };

      await this.authProducer.publishMFAEnabled(event);

      logger.info('MFA enabled successfully', { userId });
      metrics.incrementCounter('mfa_enabled_success');

      return {
        success: true,
        backup_codes: mfaSecret.backup_codes,
      };
    } catch (error) {
      logger.error('MFA verification failed', { userId, error });
      throw error;
    }
  }

  /**
   * Verify MFA token during login
   */
  async verifyMFAToken(userId: string, code: string): Promise<boolean> {
    try {
      // Get user
      const user = await this.userModel.findById(userId);
      if (!user || !user.mfa_enabled || !user.mfa_secret) {
        return false;
      }

      // Try TOTP verification first
      const verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: code,
        window: 1,
      });

      if (verified) {
        logger.info('MFA token verified', { userId });
        metrics.incrementCounter('mfa_login_success');
        return true;
      }

      // Try backup code
      const backupCodeValid = await this.mfaModel.useBackupCode(userId, code);
      if (backupCodeValid) {
        logger.info('MFA backup code used', { userId });
        metrics.incrementCounter('mfa_backup_code_used');
        return true;
      }

      logger.warn('MFA verification failed', { userId });
      metrics.incrementCounter('mfa_login_failed');
      return false;
    } catch (error) {
      logger.error('MFA verification error', { userId, error });
      return false;
    }
  }

  /**
   * Disable MFA for user
   */
  async disableMFA(userId: string, code: string): Promise<void> {
    try {
      logger.info('Disabling MFA', { userId });

      // Verify current MFA code
      const verified = await this.verifyMFAToken(userId, code);
      if (!verified) {
        throw new ValidationError('Invalid MFA code');
      }

      // Disable MFA
      await this.userModel.disableMFA(userId);

      // Delete MFA secret
      await this.mfaModel.delete(userId);

      logger.info('MFA disabled successfully', { userId });
      metrics.incrementCounter('mfa_disabled');
    } catch (error) {
      logger.error('MFA disable failed', { userId, error });
      throw error;
    }
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string, code: string): Promise<string[]> {
    try {
      logger.info('Regenerating backup codes', { userId });

      // Verify current MFA code
      const verified = await this.verifyMFAToken(userId, code);
      if (!verified) {
        throw new ValidationError('Invalid MFA code');
      }

      // Generate new codes
      const backupCodes = await this.mfaModel.regenerateBackupCodes(userId);

      logger.info('Backup codes regenerated', { userId });
      metrics.incrementCounter('mfa_backup_codes_regenerated');

      return backupCodes;
    } catch (error) {
      logger.error('Backup codes regeneration failed', { userId, error });
      throw error;
    }
  }

  /**
   * Get MFA status for user
   */
  async getMFAStatus(userId: string): Promise<{
    enabled: boolean;
    verified: boolean;
    backup_codes_remaining: number;
  }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new ValidationError('User not found');
    }

    if (!user.mfa_enabled) {
      return {
        enabled: false,
        verified: false,
        backup_codes_remaining: 0,
      };
    }

    const mfaSecret = await this.mfaModel.findByUserId(userId);
    
    return {
      enabled: true,
      verified: !!mfaSecret?.verified_at,
      backup_codes_remaining: mfaSecret?.backup_codes?.length || 0,
    };
  }
}
