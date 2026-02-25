/**
 * Preferences Controller
 */

import { Request, Response } from 'express';
import { PreferencesService } from '../services/preferences.service';
import { ok } from '@social-media/shared';

export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  /**
   * GET /api/v1/notifications/preferences
   */
  async get(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const prefs = await this.preferencesService.get(userId);
    ok(res, prefs);
  }

  /**
   * PUT /api/v1/notifications/preferences
   */
  async update(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const prefs = await this.preferencesService.update(userId, req.body);
    ok(res, prefs);
  }
}
