/**
 * MFA Controller
 * Handles HTTP requests for MFA operations
 */

import { Request, Response } from 'express';
import { MFAService } from '../services/mfa.service';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { VerifyMFADto } from '../types';

export class MFAController {
  constructor(private mfaService: MFAService) {}

  /**
   * Setup MFA (generate secret and QR code)
   * POST /api/v1/mfa/setup
   */
  async setupMFA(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      logger.info('MFA setup request', { userId });

      const result = await this.mfaService.setupMFA(userId);

      res.json({
        success: true,
        data: {
          secret: result.secret,
          qr_code: result.qr_code,
          backup_codes: result.backup_codes,
        },
        message: 'MFA setup initiated. Please scan QR code and verify with code.',
      });

      metrics.recordRequestDuration('mfa_setup', Date.now() - startTime);
    } catch (error) {
      logger.error('MFA setup failed', { error });
      throw error;
    }
  }

  /**
   * Verify MFA code and enable MFA
   * POST /api/v1/mfa/verify
   */
  async verifyMFA(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const data: VerifyMFADto = req.body;

      logger.info('MFA verification request', { userId });

      const result = await this.mfaService.verifyAndEnableMFA(userId, data);

      res.json({
        success: true,
        data: {
          enabled: true,
          backup_codes: result.backup_codes,
        },
        message: 'MFA enabled successfully. Save your backup codes in a safe place.',
      });
    } catch (error) {
      logger.error('MFA verification failed', { error });
      throw error;
    }
  }

  /**
   * Disable MFA
   * POST /api/v1/mfa/disable
   */
  async disableMFA(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const { code } = req.body;

      if (!code) {
        res.status(400).json({
          success: false,
          error: 'MFA code is required',
          code: 'MISSING_MFA_CODE',
        });
        return;
      }

      logger.info('MFA disable request', { userId });

      await this.mfaService.disableMFA(userId, code);

      res.json({
        success: true,
        message: 'MFA disabled successfully',
      });
    } catch (error) {
      logger.error('MFA disable failed', { error });
      throw error;
    }
  }

  /**
   * Regenerate backup codes
   * POST /api/v1/mfa/regenerate-codes
   */
  async regenerateBackupCodes(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const { code } = req.body;

      if (!code) {
        res.status(400).json({
          success: false,
          error: 'MFA code is required',
          code: 'MISSING_MFA_CODE',
        });
        return;
      }

      logger.info('Backup codes regeneration request', { userId });

      const backupCodes = await this.mfaService.regenerateBackupCodes(userId, code);

      res.json({
        success: true,
        data: {
          backup_codes: backupCodes,
        },
        message: 'Backup codes regenerated successfully. Save them in a safe place.',
      });
    } catch (error) {
      logger.error('Backup codes regeneration failed', { error });
      throw error;
    }
  }

  /**
   * Get MFA status
   * GET /api/v1/mfa/status
   */
  async getMFAStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const status = await this.mfaService.getMFAStatus(userId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Get MFA status failed', { error });
      throw error;
    }
  }
}
