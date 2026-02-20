import { Request, Response, NextFunction } from 'express';
import { feedService } from '../services/feed.service';
import { config } from '../config';
import { logger } from '../utils/logger';
import { UnauthorizedError } from '../types';

export class FeedController {
  /**
   * GET /api/v1/feed
   * Returns the authenticated user's personalised feed (paginated).
   */
  async getMyFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const userId = req.user.id;
      const cursor = (req.query.cursor as string | undefined) ?? null;
      const limit = Math.min(
        parseInt((req.query.limit as string) || String(config.FEED.DEFAULT_PAGE_SIZE), 10),
        config.FEED.MAX_PAGE_SIZE,
      );

      const { entries, nextCursor, hasMore } = await feedService.getFeed(userId, cursor, limit);

      // Hydrate entries with post details (service returns lightweight items for now)
      const items = await feedService.hydrateFeedEntries(entries);

      logger.info('Feed fetched', { userId, count: items.length, hasMore });

      res.status(200).json({
        success: true,
        data: {
          items,
          nextCursor,
          hasMore,
          total: items.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/feed
   * Clear the authenticated user's feed (useful for testing / admin purposes).
   */
  async clearMyFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      await feedService.clearFeed(req.user.id);

      res.status(200).json({ success: true, data: { message: 'Feed cleared' } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/feed/size
   * Returns the number of posts in the authenticated user's feed.
   */
  async getFeedSize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const size = await feedService.getFeedSize(req.user.id);

      res.status(200).json({ success: true, data: { size } });
    } catch (err) {
      next(err);
    }
  }
}

export const feedController = new FeedController();
