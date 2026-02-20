/**
 * Comment Service — Business logic for comments (nested via Closure Table)
 */

import { CommentModel } from '../models/comment.model';
import { LikeModel } from '../models/like.model';
import { InteractionProducer } from '../kafka/producers/interaction.producer';
import { CounterService } from './counter.service';
import {
  Comment,
  CommentWithReplies,
  CreateCommentDto,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../types';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { config } from '../config';

export class CommentService {
  constructor(
    private readonly commentModel: CommentModel,
    private readonly likeModel: LikeModel,
    private readonly counterService: CounterService,
    private readonly producer: InteractionProducer
  ) {}

  /**
   * Create a new comment.
   * Validates content length and max nesting depth (≤ 3).
   */
  async createComment(data: CreateCommentDto): Promise<Comment> {
    if (!data.content || data.content.trim().length === 0) {
      throw new ValidationError('Comment content cannot be empty');
    }

    if (data.content.length > config.BUSINESS.COMMENT_MAX_LENGTH) {
      throw new ValidationError(
        `Comment content cannot exceed ${config.BUSINESS.COMMENT_MAX_LENGTH} characters`
      );
    }

    let depth = 0;

    if (data.parent_id) {
      const parent = await this.commentModel.findById(data.parent_id);
      if (!parent) {
        throw new NotFoundError('Parent comment not found');
      }
      depth = parent.depth + 1;
      if (depth > config.BUSINESS.COMMENT_MAX_DEPTH) {
        throw new ValidationError(
          `Maximum comment nesting depth (${config.BUSINESS.COMMENT_MAX_DEPTH}) exceeded`
        );
      }
    }

    const comment = await this.commentModel.create(data, depth);

    // Increment Redis counter
    await this.counterService.incrementComments(data.post_id);

    // Publish Kafka event
    await this.producer.publishCommentCreated({
      type: 'comment_created',
      entityId: comment.id,
      userId: data.user_id,
      timestamp: new Date().toISOString(),
      payload: {
        postId: data.post_id,
        parentId: data.parent_id || null,
        content: data.content,
      },
    });

    metrics.incrementCounter('comment_created');
    logger.info('Comment created', { commentId: comment.id, postId: data.post_id, userId: data.user_id });

    return comment;
  }

  /**
   * Get paginated root-level comments for a post (with replies_count each).
   */
  async getCommentsByPost(
    postId: string,
    limit = 20,
    cursor?: string
  ): Promise<{ comments: CommentWithReplies[]; cursor?: string; hasMore: boolean }> {
    const fetchLimit = limit + 1;
    const comments = await this.commentModel.findByPost(postId, fetchLimit, cursor);

    const hasMore = comments.length > limit;
    const items = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore
      ? items[items.length - 1].created_at.toISOString()
      : undefined;

    return { comments: items, cursor: nextCursor, hasMore };
  }

  /**
   * Get replies to a comment.
   */
  async getReplies(
    parentId: string,
    limit = 20
  ): Promise<CommentWithReplies[]> {
    const parent = await this.commentModel.findById(parentId);
    if (!parent) throw new NotFoundError('Comment not found');

    return this.commentModel.findReplies(parentId, limit);
  }

  /**
   * Soft delete a comment (only owner can delete).
   */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.commentModel.findById(commentId);
    if (!comment) throw new NotFoundError('Comment not found');
    if (comment.user_id !== userId) throw new ForbiddenError('You can only delete your own comments');

    const deleted = await this.commentModel.softDelete(commentId);
    if (!deleted) throw new NotFoundError('Comment not found or already deleted');

    // Decrement counter
    await this.counterService.decrementComments(comment.post_id);

    await this.producer.publishCommentDeleted({
      type: 'comment_deleted',
      entityId: commentId,
      userId,
      timestamp: new Date().toISOString(),
      payload: { postId: comment.post_id },
    });

    metrics.incrementCounter('comment_deleted');
    logger.info('Comment deleted', { commentId, userId });
  }

  /**
   * Get comment by ID.
   */
  async getCommentById(id: string): Promise<Comment> {
    const comment = await this.commentModel.findById(id);
    if (!comment) throw new NotFoundError('Comment not found');
    return comment;
  }
}
