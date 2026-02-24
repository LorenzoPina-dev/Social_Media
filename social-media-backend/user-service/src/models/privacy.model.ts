import { getDatabase } from '../config/database';
import { PrivacySettings, UpdatePrivacySettingsDto } from '../types';

export class PrivacyModel {
  private readonly table = 'user_privacy_settings';

  async findByUserId(userId: string): Promise<PrivacySettings | null> {
    const db = getDatabase();
    const settings = await db(this.table).where({ user_id: userId }).first();
    return settings ? this.normalize(settings) : null;
  }

  async createDefault(userId: string): Promise<PrivacySettings> {
    const db = getDatabase();
    const [settings] = await db(this.table)
      .insert({
        user_id: userId,
        is_private: false,
        show_activity_status: true,
        allow_tagging: true,
        allow_mentions: true,
        allow_direct_messages: 'everyone',
        blocked_users: [],
        muted_users: [],
        hide_likes_and_views: false,
        comment_filter: 'everyone',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    return this.normalize(settings);
  }

  async upsert(userId: string, data: UpdatePrivacySettingsDto): Promise<PrivacySettings> {
    const db = getDatabase();
    const existing = await db(this.table).where({ user_id: userId }).first();

    if (!existing) {
      await this.createDefault(userId);
    }

    const payload: Record<string, unknown> = {
      ...data,
      updated_at: new Date(),
    };

    if (data.blocked_users !== undefined) {
      payload.blocked_users = data.blocked_users;
    }
    if (data.muted_users !== undefined) {
      payload.muted_users = data.muted_users;
    }

    const [updated] = await db(this.table)
      .where({ user_id: userId })
      .update(payload)
      .returning('*');

    return this.normalize(updated);
  }

  private normalize(raw: Record<string, unknown>): PrivacySettings {
    const blocked =
      typeof raw.blocked_users === 'string' ? JSON.parse(raw.blocked_users) : raw.blocked_users;
    const muted =
      typeof raw.muted_users === 'string' ? JSON.parse(raw.muted_users) : raw.muted_users;

    return {
      ...(raw as unknown as PrivacySettings),
      blocked_users: Array.isArray(blocked) ? blocked : [],
      muted_users: Array.isArray(muted) ? muted : [],
    };
  }
}
