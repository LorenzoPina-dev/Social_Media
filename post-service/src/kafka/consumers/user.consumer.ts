/**
 * User Event Consumer — topic: user_events
 *
 * Handler: user_deleted → soft delete tutti i post dell'utente (GDPR)
 */

import { PostModel } from '../../models/post.model';
import { logger } from '../../utils/logger';

interface UserDeletedEvent {
  type: 'user_deleted' | string;
  entityId?: string;
  userId: string;
  timestamp: string;
}

export class UserEventConsumer {
  constructor(private postModel: PostModel) {}

  async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    try {
      const userId = event.userId || event.entityId;
      if (!userId) {
        logger.warn('user_deleted event missing userId', { event });
        return;
      }
      const count = await this.postModel.softDeleteAllByUser(userId);
      logger.info('Posts soft-deleted for deleted user (GDPR)', { userId, count });
    } catch (error) {
      logger.error('Failed to handle user_deleted event', { error, event });
      throw error; // let the consumer retry
    }
  }

  async processMessage(event: unknown): Promise<void> {
    const e = event as UserDeletedEvent;
    switch (e.type) {
      case 'user_deleted':
      case 'user_permanently_deleted':
        await this.handleUserDeleted(e);
        break;
      default:
        // Other user events ignored by post-service
        break;
    }
  }
}

export default UserEventConsumer;
