/**
 * Post Controller — HTTP handlers
 *
 * Fix: usa next(error) per propagare gli errori all'errorHandler globale
 * invece di gestirli manualmente in ogni handler (BUG 10).
 * Express-async-errors garantisce che i Promise rejection vengano
 * automaticamente passati a next().
 */

import { Request, Response, NextFunction } from 'express';
import { PostService } from '../services/post.service';
import { HashtagService } from '../services/hashtag.service';

export class PostController {
  constructor(
    private postService: PostService,
    private hashtagService: HashtagService,
  ) {}

  /**
   * POST /api/v1/posts
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const post = await this.postService.createPost(userId, req.body);
      res.status(201).json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/posts/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const requesterId = req.user?.id;
      const post = await this.postService.getPost(id, requesterId);
      res.json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/posts/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const post = await this.postService.updatePost(id, userId, req.body);
      res.json({ success: true, data: post });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/posts/:id
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      await this.postService.deletePost(id, userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/users/:userId/posts
   */
  async listByUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const requesterId = req.user?.id;
      const { cursor, limit } = req.query as { cursor?: string; limit?: string };
      const result = await this.postService.listByUser(userId, requesterId, {
        cursor,
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/posts/trending/hashtags
   */
  async getTrendingHashtags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt((req.query.limit as string) || '10', 10);
      const hashtags = await this.hashtagService.getTrending(limit);
      res.json({ success: true, data: hashtags });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/posts/:id/history
   */
  async getEditHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const requesterId = req.user!.id;
      const history = await this.postService.getEditHistory(id, requesterId);
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  }
}
