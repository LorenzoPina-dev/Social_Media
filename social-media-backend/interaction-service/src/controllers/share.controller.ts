/**
 * Share Controller — HTTP handlers for shares
 */

import { Request, Response } from 'express';
import { ShareService } from '../services/share.service';

export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  /**
   * POST /api/v1/posts/:postId/share
   */
  async sharePost(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { postId } = req.params;
    const { comment } = req.body;

    const { share, count } = await this.shareService.createShare({
      user_id: userId,
      post_id: postId,
      comment,
    });

    res.status(201).json({
      success: true,
      data: { share, share_count: count },
    });
  }

  /**
   * GET /api/v1/posts/:postId/shares/count
   */
  async getShareCount(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const count = await this.shareService.getShareCount(postId);

    res.status(200).json({
      success: true,
      data: { post_id: postId, share_count: count },
    });
  }

  /**
   * GET /api/v1/posts/:postId/shares
   */
  async getSharesByPost(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
    const cursor = req.query.cursor as string | undefined;

    const { shares, hasMore, cursor: nextCursor } = await this.shareService.getSharesByPost(
      postId,
      limit,
      cursor
    );

    res.status(200).json({
      success: true,
      data: shares,
      pagination: { cursor: nextCursor, has_more: hasMore },
    });
  }
}
