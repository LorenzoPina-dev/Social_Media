/**
 * Comment Controller — HTTP handlers for comments
 */

import { Request, Response } from 'express';
import { CommentService } from '../services/comment.service';
import { created, noContent, ok } from '@social-media/shared/dist/utils/http';

export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  /**
   * POST /api/v1/posts/:postId/comments
   */
  async createComment(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { postId } = req.params;
    const { content, parent_id } = req.body;

    const comment = await this.commentService.createComment({
      post_id: postId,
      user_id: userId,
      parent_id: parent_id || null,
      content,
    });

    created(res, comment);
  }

  /**
   * GET /api/v1/posts/:postId/comments
   */
  async getCommentsByPost(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
    const cursor = req.query.cursor as string | undefined;

    const { comments, cursor: nextCursor, hasMore } = await this.commentService.getCommentsByPost(
      postId,
      limit,
      cursor
    );

    ok(res, {
      items: comments,
      pagination: { cursor: nextCursor, has_more: hasMore },
    });
  }

  /**
   * GET /api/v1/comments/:commentId/replies
   */
  async getReplies(req: Request, res: Response): Promise<void> {
    const { commentId } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);

    const replies = await this.commentService.getReplies(commentId, limit);

    ok(res, replies);
  }

  /**
   * GET /api/v1/comments/:commentId
   */
  async getComment(req: Request, res: Response): Promise<void> {
    const { commentId } = req.params;
    const comment = await this.commentService.getCommentById(commentId);

    ok(res, comment);
  }

  /**
   * DELETE /api/v1/comments/:commentId
   */
  async deleteComment(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { commentId } = req.params;

    await this.commentService.deleteComment(commentId, userId);

    noContent(res);
  }
}
