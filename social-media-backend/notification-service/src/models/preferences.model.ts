/**
 * Notification Preferences Model
 */

import { getDatabase } from '../config/database';
import { NotificationPreferences, UpdatePreferencesDto } from '../types';

export class PreferencesModel {
  private get db() {
    return getDatabase();
  }

  async findByUserId(userId: string): Promise<NotificationPreferences | undefined> {
    return this.db('notification_preferences').where({ user_id: userId }).first() as Promise<
      NotificationPreferences | undefined
    >;
  }

  /**
   * Crea preferenze di default oppure aggiorna quelle esistenti (upsert)
   */
  async upsert(userId: string, dto: UpdatePreferencesDto = {}): Promise<NotificationPreferences> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      const [updated] = await this.db('notification_preferences')
        .where({ user_id: userId })
        .update({ ...dto, updated_at: new Date() })
        .returning('*');
      return updated as NotificationPreferences;
    }

    const [created] = await this.db('notification_preferences')
      .insert({ user_id: userId, ...dto })
      .returning('*');
    return created as NotificationPreferences;
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db('notification_preferences').where({ user_id: userId }).delete();
  }
}
