/**
 * GDPR Controller
 * Handles GDPR compliance operations (data export, deletion)
 */

import { Request, Response } from 'express';
import { GDPRService } from '../services/gdpr.service';
import { logger } from '../utils/logger';

export class GDPRController {
  constructor(private gdprService: GDPRService) {}

  /**
   * Export user data
   * GET /api/v1/users/:id/export
   */
  async exportUserData(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const currentUserId = (req as any).user?.id;

    try {
      // Check authorization
      if (currentUserId !== id) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You can only export your own data',
        });
        return;
      }

      logger.info('Exporting user data', { userId: id });

      const exportData = await this.gdprService.exportUserData(id);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="user_data_${id}_${Date.now()}.json"`
      );

      res.json(exportData);
    } catch (error) {
      logger.error('Failed to export user data', { error, userId: id });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to export user data',
      });
    }
  }

  /**
   * Request account deletion
   * POST /api/v1/users/:id/delete-request
   */
  async requestDeletion(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const currentUserId = (req as any).user?.id;

    try {
      if (currentUserId !== id) {
        res.status(403).json({
          error: 'Forbidden',
        });
        return;
      }

      logger.info('Requesting account deletion', { userId: id });

      await this.gdprService.requestDeletion(id);

      res.json({
        success: true,
        message: 'Account deletion requested',
        data: {
          gracePeriodDays: 30,
          cancelBefore: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      logger.error('Failed to request deletion', { error, userId: id });
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }

  /**
   * Cancel deletion request
   * POST /api/v1/users/:id/cancel-deletion
   */
  async cancelDeletion(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const currentUserId = (req as any).user?.id;

    try {
      if (currentUserId !== id) {
        res.status(403).json({
          error: 'Forbidden',
        });
        return;
      }

      logger.info('Canceling account deletion', { userId: id });

      await this.gdprService.cancelDeletion(id);

      res.json({
        success: true,
        message: 'Account deletion cancelled',
      });
    } catch (error: any) {
      if (error.message === 'No deletion request found') {
        res.status(404).json({
          error: 'Not found',
          message: 'No active deletion request found',
        });
        return;
      }

      logger.error('Failed to cancel deletion', { error, userId: id });
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get data processing status
   * GET /api/v1/users/:id/data-status
   */
  async getDataStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const currentUserId = (req as any).user?.id;

    try {
      if (currentUserId !== id) {
        res.status(403).json({
          error: 'Forbidden',
        });
        return;
      }

      const status = await this.gdprService.getDataStatus(id);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Failed to get data status', { error, userId: id });
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
}
