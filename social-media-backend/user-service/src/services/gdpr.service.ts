/**
 * GDPR Service
 * Handles GDPR compliance operations
 */

import { UserService } from './user.service';
import { FollowerService } from './follower.service';
import { UserProducer } from '../kafka/producers/user.producer';
import { logger } from '../utils/logger';
import { GDPRExportData } from '../types';
import { config } from '../config';

export class GDPRService {
  constructor(
    private userService: UserService,
    private followerService: FollowerService,
    private userProducer: UserProducer
  ) {}

  /**
   * Export all user data (GDPR Right to Access)
   */
  async exportUserData(userId: string): Promise<GDPRExportData> {
    try {
      logger.info('Exporting user data', { userId });

      // Get user data
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get followers and following
      const [followers, following] = await Promise.all([
        this.followerService.getFollowers(userId, { limit: 10000 }),
        this.followerService.getFollowing(userId, { limit: 10000 }),
      ]);

      // Construct export data
      const exportData: GDPRExportData = {
        user,
        followers,
        following,
        exportDate: new Date(),
        format: config.GDPR.DATA_EXPORT_FORMAT,
      };

      // Publish event
      await this.userProducer.publishDataExported({
        userId,
        timestamp: new Date(),
      });

      return exportData;
    } catch (error) {
      logger.error('Failed to export user data', { error, userId });
      throw error;
    }
  }

  /**
   * Request account deletion (GDPR Right to Erasure)
   */
  async requestDeletion(userId: string): Promise<void> {
    try {
      logger.info('Requesting account deletion', { userId });

      // Soft delete the user
      await this.userService.softDelete(userId);

      // Schedule hard deletion after grace period
      const deletionDate = new Date();
      deletionDate.setSeconds(deletionDate.getSeconds() + config.GDPR.SOFT_DELETE_GRACE_PERIOD);

      // Publish deletion request event
      await this.userProducer.publishUserDeletionRequested({
        userId,
        requestedAt: new Date(),
        gracePeriodDays: 30,
        scheduledDeletionAt: deletionDate,
      });

      logger.info('Account deletion scheduled', { userId, scheduledFor: deletionDate });
    } catch (error) {
      logger.error('Failed to request deletion', { error, userId });
      throw error;
    }
  }

  /**
   * Cancel deletion request
   */
  async cancelDeletion(userId: string): Promise<void> {
    try {
      logger.info('Canceling account deletion', { userId });

      const user = await this.userService.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.status !== 'PENDING_DELETION') {
        throw new Error('No deletion request found');
      }

      // Restore user status
      await this.userService.update(userId, {
        // Reset status to ACTIVE
      } as any);

      // Publish cancellation event
      await this.userProducer.publishDeletionCancelled({
        userId,
        cancelledAt: new Date(),
      });

      logger.info('Account deletion cancelled', { userId });
    } catch (error) {
      logger.error('Failed to cancel deletion', { error, userId });
      throw error;
    }
  }

  /**
   * Get data processing status
   */
  async getDataStatus(userId: string): Promise<{
    userId: string;
    status: string;
    deletionScheduled: boolean;
    deletionDate?: Date;
    dataRetention: {
      profiles: string;
      followers: string;
      posts: string;
    };
  }> {
    try {
      const user = await this.userService.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const deletionScheduled = user.status === 'PENDING_DELETION';
      let deletionDate: Date | undefined;

      if (deletionScheduled && user.deleted_at) {
        deletionDate = new Date(user.deleted_at);
        deletionDate.setSeconds(
          deletionDate.getSeconds() + config.GDPR.SOFT_DELETE_GRACE_PERIOD
        );
      }

      return {
        userId,
        status: user.status,
        deletionScheduled,
        deletionDate,
        dataRetention: {
          profiles: '30 days after deletion request',
          followers: 'Immediate upon deletion',
          posts: '30 days after deletion request',
        },
      };
    } catch (error) {
      logger.error('Failed to get data status', { error, userId });
      throw error;
    }
  }

  /**
   * Permanently delete user data (after grace period)
   */
  async permanentlyDeleteUser(userId: string): Promise<void> {
    try {
      logger.info('Permanently deleting user', { userId });

      // Remove all followers/following relationships
      await this.followerService.removeAllFollowers(userId);

      // Hard delete user
      await this.userService.hardDelete(userId);

      // Publish permanent deletion event
      await this.userProducer.publishUserPermanentlyDeleted({
        userId,
        deletedAt: new Date(),
      });

      logger.info('User permanently deleted', { userId });
    } catch (error) {
      logger.error('Failed to permanently delete user', { error, userId });
      throw error;
    }
  }

  /**
   * Anonymize user data (alternative to deletion)
   */
  async anonymizeUser(userId: string): Promise<void> {
    try {
      logger.info('Anonymizing user data', { userId });

      // Update user with anonymized data
      await this.userService.update(userId, {
        display_name: 'Deleted User',
        bio: undefined,
        avatar_url: undefined,
      });

      // Publish anonymization event
      await this.userProducer.publishUserAnonymized({
        userId,
        anonymizedAt: new Date(),
      });

      logger.info('User data anonymized', { userId });
    } catch (error) {
      logger.error('Failed to anonymize user', { error, userId });
      throw error;
    }
  }
}
