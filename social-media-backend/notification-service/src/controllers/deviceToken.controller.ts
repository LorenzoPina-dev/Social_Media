/**
 * Device Token Controller
 */

import { Request, Response } from 'express';
import { DeviceTokenService } from '../services/deviceToken.service';
import { created, fail, ok } from '@social-media/shared';

export class DeviceTokenController {
  constructor(private readonly deviceTokenService: DeviceTokenService) {}

  /**
   * POST /api/v1/notifications/devices
   */
  async register(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { token, platform } = req.body;

    const deviceToken = await this.deviceTokenService.register(userId, token, platform);
    created(res, deviceToken);
  }

  /**
   * DELETE /api/v1/notifications/devices/:token
   */
  async unregister(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { token } = req.params;

    const deleted = await this.deviceTokenService.unregister(userId, token);
    if (!deleted) {
      fail(res, 404, 'NOT_FOUND', 'Device token not found');
      return;
    }
    ok(res, { deleted: true });
  }

  /**
   * GET /api/v1/notifications/devices
   */
  async list(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const tokens = await this.deviceTokenService.getUserTokens(userId);
    ok(res, tokens);
  }
}
