/**
 * MFA Controller
 * Handles HTTP requests for MFA operations
 */

import { Request, Response } from 'express';
import { MFAService } from '../services/mfa.service';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { VerifyMFADto } from '../types';
import { fail, ok } from '@social-media/shared';

export class MFAController {
  constructor(private mfaService: MFAService) {}

  /**
   * Setup MFA (generate secret and QR code)
   * POST /api/v1/mfa/setup
   * Requires authentication
   */
  async setupMFA(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const userId = req.user?.id;

      if (!userId) {
        fail(res, 401, 'UNAUTHORIZED', 'Unauthorized');
        return;
      }

      logger.info('MFA setup request', { userId });

      const result = await this.mfaService.setupMFA(userId);

      ok(
        res,
        {
          secret: result.secret,
          qr_code: result.qr_code,
          backup_codes: result.backup_codes,
        },
        'MFA setup initiated. Please scan QR code and verify with code.',
      );

      metrics.recordRequestDuration('mfa_setup', Date.now() - startTime);
    } catch (error) {
      logger.error('MFA setup failed', { error });
      throw error;
    }
  }

  /**
   * Verify MFA code and enable MFA
   * POST /api/v1/mfa/verify
   * Requires authentication
   */
  async verifyMFA(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        fail(res, 401, 'UNAUTHORIZED', 'Unauthorized');
        return;
      }

      const data: VerifyMFADto = req.body;

      logger.info('MFA verification request', { userId });

      const result = await this.mfaService.verifyAndEnableMFA(userId, data);

      ok(
        res,
        {
          enabled: true,
          backup_codes: result.backup_codes,
        },
        'MFA enabled successfully. Save your backup codes in a safe place.',
      );
    } catch (error) {
      logger.error('MFA verification failed', { error });
      throw error;
    }
  }

  /**
   * Disable MFA
   * POST /api/v1/mfa/disable
   * Requires authentication
   */
  async disableMFA(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        fail(res, 401, 'UNAUTHORIZED', 'Unauthorized');
        return;
      }

      const { code } = req.body;

      if (!code) {
        fail(res, 400, 'MISSING_MFA_CODE', 'MFA code is required');
        return;
      }

      logger.info('MFA disable request', { userId });

      await this.mfaService.disableMFA(userId, code);

      ok(res, { enabled: false }, 'MFA disabled successfully');
    } catch (error) {
      logger.error('MFA disable failed', { error });
      throw error;
    }
  }

  /**
   * Regenerate backup codes
   * POST /api/v1/mfa/regenerate-codes
   * Requires authentication
   */
  async regenerateBackupCodes(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        fail(res, 401, 'UNAUTHORIZED', 'Unauthorized');
        return;
      }

      const { code } = req.body;

      if (!code) {
        fail(res, 400, 'MISSING_MFA_CODE', 'MFA code is required');
        return;
      }

      logger.info('Backup codes regeneration request', { userId });

      const backupCodes = await this.mfaService.regenerateBackupCodes(userId, code);

      ok(
        res,
        {
          backup_codes: backupCodes,
        },
        'Backup codes regenerated successfully. Save them in a safe place.',
      );
    } catch (error) {
      logger.error('Backup codes regeneration failed', { error });
      throw error;
    }
  }

  /**
   * Get MFA status
   * GET /api/v1/mfa/status
   * Requires authentication
   */
  async getMFAStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        fail(res, 401, 'UNAUTHORIZED', 'Unauthorized');
        return;
      }

      const status = await this.mfaService.getMFAStatus(userId);

      ok(res, status);
    } catch (error) {
      logger.error('Get MFA status failed', { error });
      throw error;
    }
  }
}
