/**
 * Device Token Controller
 */

import { Request, Response } from 'express';
import { DeviceTokenService } from '../services/deviceToken.service';

export class DeviceTokenController {
  constructor(private readonly deviceTokenService: DeviceTokenService) {}

  /**
   * POST /api/v1/notifications/devices
   */
  async register(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { token, platform } = req.body;

    const deviceToken = await this.deviceTokenService.register(userId, token, platform);
    res.status(201).json({ success: true, data: deviceToken });
  }

  /**
   * DELETE /api/v1/notifications/devices/:token
   */
  async unregister(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { token } = req.params;

    const deleted = await this.deviceTokenService.unregister(userId, token);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Device token not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true });
  }

  /**
   * GET /api/v1/notifications/devices
   */
  async list(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const tokens = await this.deviceTokenService.getUserTokens(userId);
    res.json({ success: true, data: tokens });
  }
}
