/**
 * Like Controller — HTTP handlers for like/unlike operations
 */

import { Request, Response } from 'express';
import { LikeService } from '../services/like.service';
import { LikeTargetType } from '../types';
import { logger } from '../utils/logger';

export class LikeController {
  constructor(private readonly likeService: LikeService) {}

  /**
   * POST /api/v1/posts/:postId/like
   */
  async likePost(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { postId } = req.params;

    const { like, count } = await this.likeService.addLike(userId, postId, 'POST');

    res.status(201).json({
      success: true,
      data: { like, like_count: count },
    });
  }

  /**
   * DELETE /api/v1/posts/:postId/like
   */
  async unlikePost(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { postId } = req.params;

    const { count } = await this.likeService.removeLike(userId, postId, 'POST');

    res.status(200).json({
      success: true,
      data: { like_count: count },
    });
  }

  /**
   * POST /api/v1/comments/:commentId/like
   */
  async likeComment(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { commentId } = req.params;

    const { like, count } = await this.likeService.addLike(userId, commentId, 'COMMENT');

    res.status(201).json({
      success: true,
      data: { like, like_count: count },
    });
  }

  /**
   * DELETE /api/v1/comments/:commentId/like
   */
  async unlikeComment(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { commentId } = req.params;

    const { count } = await this.likeService.removeLike(userId, commentId, 'COMMENT');

    res.status(200).json({
      success: true,
      data: { like_count: count },
    });
  }

  /**
   * GET /api/v1/posts/:postId/likes/count
   */
  async getPostLikeCount(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const count = await this.likeService.getLikeCount(postId, 'POST');

    let isLiked = false;
    if (req.user) {
      isLiked = await this.likeService.hasLiked(req.user.id, postId, 'POST');
    }

    res.status(200).json({
      success: true,
      data: { post_id: postId, like_count: count, is_liked: isLiked },
    });
  }
}
