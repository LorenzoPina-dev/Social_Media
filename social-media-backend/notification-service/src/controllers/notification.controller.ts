/**
 * Notification Controller
 */

import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { fail, ok } from '@social-media/shared';
//import { logger } from '../utils/logger';

export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /api/v1/notifications
   */
  async list(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query['limit'] as string || '20', 10), 50);
    const cursor = req.query['cursor'] as string | undefined;

    const result = await this.notificationService.getNotifications(userId, limit, cursor);

    ok(res, {
      items: result.notifications,
      hasMore: result.hasMore,
      cursor: result.nextCursor,
    });
  }

  /**
   * GET /api/v1/notifications/unread-count
   */
  async unreadCount(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const count = await this.notificationService.getUnreadCount(userId);
    ok(res, { count });
  }

  /**
   * PUT /api/v1/notifications/:id/read
   */
  async markRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;

    const updated = await this.notificationService.markAsRead(id, userId);
    if (!updated) {
      fail(res, 404, 'NOT_FOUND', 'Notification not found');
      return;
    }
    ok(res, { updated: true });
  }

  /**
   * PUT /api/v1/notifications/read-all
   */
  async markAllRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const count = await this.notificationService.markAllAsRead(userId);
    ok(res, { markedCount: count });
  }
}
