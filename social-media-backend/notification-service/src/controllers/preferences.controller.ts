/**
 * Preferences Controller
 */

import { Request, Response } from 'express';
import { PreferencesService } from '../services/preferences.service';

export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  /**
   * GET /api/v1/notifications/preferences
   */
  async get(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const prefs = await this.preferencesService.get(userId);
    res.json({ success: true, data: prefs });
  }

  /**
   * PUT /api/v1/notifications/preferences
   */
  async update(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const prefs = await this.preferencesService.update(userId, req.body);
    res.json({ success: true, data: prefs });
  }
}
