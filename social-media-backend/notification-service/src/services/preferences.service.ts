/**
 * Preferences Service
 */

import { PreferencesModel } from '../models/preferences.model';
import { NotificationPreferences, UpdatePreferencesDto } from '../types';

export class PreferencesService {
  constructor(private readonly preferencesModel: PreferencesModel) {}

  async get(userId: string): Promise<NotificationPreferences> {
    const prefs = await this.preferencesModel.findByUserId(userId);
    if (prefs) return prefs;
    // Crea preferenze di default al primo accesso
    return this.preferencesModel.upsert(userId, {});
  }

  async update(userId: string, dto: UpdatePreferencesDto): Promise<NotificationPreferences> {
    return this.preferencesModel.upsert(userId, dto);
  }
}
