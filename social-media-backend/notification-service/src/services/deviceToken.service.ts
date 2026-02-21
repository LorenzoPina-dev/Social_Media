/**
 * Device Token Service — registrazione/rimozione token push
 */

import { DeviceTokenModel } from '../models/deviceToken.model';
import { DeviceToken, Platform } from '../types';
import { logger } from '../utils/logger';

export class DeviceTokenService {
  constructor(private readonly deviceTokenModel: DeviceTokenModel) {}

  async register(userId: string, token: string, platform: Platform): Promise<DeviceToken> {
    const result = await this.deviceTokenModel.upsert(userId, token, platform);
    logger.info('Device token registered', { userId, platform });
    return result;
  }

  async unregister(userId: string, token: string): Promise<boolean> {
    const deleted = await this.deviceTokenModel.deleteByToken(token, userId);
    if (deleted) logger.info('Device token removed', { userId });
    return deleted;
  }

  async getUserTokens(userId: string): Promise<DeviceToken[]> {
    return this.deviceTokenModel.findByUserId(userId);
  }
}
