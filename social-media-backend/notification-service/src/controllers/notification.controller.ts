/**
 * Notification Controller
 */

import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
//import { logger } from '../utils/logger';

export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /api/v1/notifications
   */
  async list(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query['limit'] as string || '20', 10), 50);
    const cursor = req.query['cursor'] as string | undefined;

    const result = await this.notificationService.getNotifications(userId, limit, cursor);

    res.json({
      success: true,
      data: result.notifications,
      hasMore: result.hasMore,
      cursor: result.nextCursor,
    });
  }

  /**
   * GET /api/v1/notifications/unread-count
   */
  async unreadCount(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const count = await this.notificationService.getUnreadCount(userId);
    res.json({ success: true, data: { count } });
  }

  /**
   * PUT /api/v1/notifications/:id/read
   */
  async markRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { id } = req.params;

    const updated = await this.notificationService.markAsRead(id, userId);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Notification not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ success: true });
  }

  /**
   * PUT /api/v1/notifications/read-all
   */
  async markAllRead(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const count = await this.notificationService.markAllAsRead(userId);
    res.json({ success: true, data: { markedCount: count } });
  }
}
