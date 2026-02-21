/**
 * Device Token Model — FCM / APNs push tokens
 */

import { getDatabase } from '../config/database';
import { DeviceToken, Platform } from '../types';

export class DeviceTokenModel {
  private get db() {
    return getDatabase();
  }

  async findByUserId(userId: string): Promise<DeviceToken[]> {
    return this.db('device_tokens').where({ user_id: userId }) as Promise<DeviceToken[]>;
  }

  async findByToken(token: string): Promise<DeviceToken | undefined> {
    return this.db('device_tokens').where({ token }).first() as Promise<DeviceToken | undefined>;
  }

  async upsert(userId: string, token: string, platform: Platform): Promise<DeviceToken> {
    const existing = await this.findByToken(token);
    if (existing) {
      const [updated] = await this.db('device_tokens')
        .where({ token })
        .update({ user_id: userId, last_used_at: new Date() })
        .returning('*');
      return updated as DeviceToken;
    }
    const [created] = await this.db('device_tokens')
      .insert({ user_id: userId, token, platform })
      .returning('*');
    return created as DeviceToken;
  }

  async deleteByToken(token: string, userId: string): Promise<boolean> {
    const deleted = await this.db('device_tokens').where({ token, user_id: userId }).delete();
    return deleted > 0;
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db('device_tokens').where({ user_id: userId }).delete();
  }
}
