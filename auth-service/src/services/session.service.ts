/**
 * Session Service
 * Session management business logic
 */

import { SessionModel } from '../models/session.model';
import { Session } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

export class SessionService {
  constructor(private sessionModel: SessionModel) {}

  /**
   * Create new session
   */
  async createSession(
    userId: string,
    refreshToken: string,
    ipAddress?: string,
    deviceInfo?: string
  ): Promise<Session> {
    // Check session limit
    const activeCount = await this.sessionModel.countActiveForUser(userId);
    
    if (activeCount >= config.SESSION.MAX_SESSIONS_PER_USER) {
      // Delete oldest session
      const sessions = await this.sessionModel.findByUserId(userId);
      if (sessions.length > 0) {
        const oldest = sessions[sessions.length - 1];
        await this.sessionModel.delete(oldest.id);
        logger.info('Deleted oldest session due to limit', { userId });
      }
    }

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + this.parseExpiryTime(config.JWT.REFRESH_EXPIRY?.toString() ?? "15m"));

    // Create session
    const session = await this.sessionModel.create({
      user_id: userId,
      refresh_token: refreshToken,
      ip_address: ipAddress,
      device_info: deviceInfo,
      expires_at: expiresAt,
    });

    logger.info('Session created', { userId, sessionId: session.id });

    return session;
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    return await this.sessionModel.findByUserId(userId);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionModel.delete(sessionId);
    logger.info('Session deleted', { sessionId });
  }

  /**
   * Delete all user sessions
   */
  async deleteAllUserSessions(userId: string): Promise<void> {
    await this.sessionModel.deleteAllForUser(userId);
    logger.info('All user sessions deleted', { userId });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const deleted = await this.sessionModel.deleteExpired();
    if (deleted > 0) {
      logger.info('Cleaned up expired sessions', { count: deleted });
    }
  }

  /**
   * Parse expiry time string to seconds
   */
  private parseExpiryTime(expiryStr: string): number {
    const match = expiryStr.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 2592000; // 30 days default
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 2592000;
    }
  }
}
