/**
 * Post Service — Business Logic
 */

import { PostModel } from '../models/post.model';
import { EditHistoryModel } from '../models/editHistory.model';
import { HashtagService } from './hashtag.service';
import { CacheService } from './cache.service';
import { PostProducer } from '../kafka/producers/post.producer';
import { logger } from '../utils/logger';
import { postMetrics } from '../utils/metrics';
import { config } from '../config';
import {
  Post,
  CreatePostDto,
  UpdatePostDto,
  ListPostsQuery,
  CursorData,
  PostNotFoundError,
  PostForbiddenError,
  ValidationError,
  PaginatedPostsResponse,
} from '../types';

// L1 in-process cache (TTL 60s, max 1000 entries)
const l1Cache = new Map<string, { post: Post; expiresAt: number }>();
const L1_TTL_MS = 60_000;
const L1_MAX = 1_000;

function l1Get(id: string): Post | null {
  const entry = l1Cache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { l1Cache.delete(id); return null; }
  return entry.post;
}

function l1Set(post: Post): void {
  if (l1Cache.size >= L1_MAX) {
    const firstKey = l1Cache.keys().next().value;
    if (firstKey !== undefined) l1Cache.delete(firstKey);
  }
  l1Cache.set(post.id, { post, expiresAt: Date.now() + L1_TTL_MS });
}

function l1Delete(id: string): void {
  l1Cache.delete(id);
}

export class PostService {
  constructor(
    private postModel: PostModel,
    private editHistoryModel: EditHistoryModel,
    private hashtagService: HashtagService,
    private cacheService: CacheService,
    private postProducer: PostProducer,
  ) {}

  // ─── CREATE ──────────────────────────────────────────────────────────────

  async createPost(userId: string, dto: CreatePostDto): Promise<Post> {
    // Validation
    if (!dto.content || dto.content.trim().length === 0) {
      throw new ValidationError('Post content cannot be empty');
    }
    if (dto.content.length > config.POST.MAX_CONTENT_LENGTH) {
      throw new ValidationError(`Post content cannot exceed ${config.POST.MAX_CONTENT_LENGTH} characters`);
    }
    if (dto.scheduled_at) {
      const scheduledDate = new Date(dto.scheduled_at);
      if (isNaN(scheduledDate.getTime())) throw new ValidationError('Invalid scheduled_at date');
      if (scheduledDate <= new Date()) throw new ValidationError('scheduled_at must be in the future');
    }

    try {
      const post = await this.postModel.create(userId, { ...dto, moderation_status: 'PENDING' });

      // Process hashtags
      const hashtags = await this.hashtagService.processForPost(post.id, post.content);

      // Cache L2
      await this.cacheService.setPost(post);
      l1Set(post);

      // Kafka
      if (dto.scheduled_at) {
        await this.postProducer.publishPostScheduled(post, new Date(dto.scheduled_at));
      } else {
        await this.postProducer.publishPostCreated(post, hashtags);
      }

      postMetrics.postsCreated.inc();
      logger.info('Post created', { postId: post.id, userId });
      return post;
    } catch (error) {
      logger.error('Failed to create post', { error, userId });
      throw error;
    }
  }

  // ─── GET ─────────────────────────────────────────────────────────────────

  async getPost(id: string, requesterId?: string): Promise<Post> {
    // L1
    const l1 = l1Get(id);
    if (l1) {
      postMetrics.cacheHit.inc({ cache_type: 'l1' });
      this.checkVisibility(l1, requesterId);
      return l1;
    }

    // L2
    const l2 = await this.cacheService.getPost(id);
    if (l2) {
      postMetrics.cacheHit.inc({ cache_type: 'l2' });
      l1Set(l2);
      this.checkVisibility(l2, requesterId);
      return l2;
    }

    // L3 — DB
    postMetrics.cacheMiss.inc({ cache_type: 'l2' });
    const post = await this.postModel.findById(id);
    if (!post) throw new PostNotFoundError(id);

    this.checkVisibility(post, requesterId);

    await this.cacheService.setPost(post);
    l1Set(post);
    return post;
  }

  private checkVisibility(post: Post, requesterId?: string): void {
    if (post.visibility === 'PRIVATE' && post.user_id !== requesterId) {
      throw new PostForbiddenError();
    }
  }

  // ─── LIST ─────────────────────────────────────────────────────────────────

  async listByUser(
    userId: string,
    requesterId: string | undefined,
    query: ListPostsQuery,
  ): Promise<PaginatedPostsResponse> {
    const limit = Math.min(query.limit || config.PAGINATION.DEFAULT_PAGE_SIZE, config.PAGINATION.MAX_PAGE_SIZE);
    const includePrivate = userId === requesterId;

    let cursor: CursorData | undefined;
    if (query.cursor) {
      try {
        cursor = JSON.parse(Buffer.from(query.cursor, 'base64').toString('utf8')) as CursorData;
      } catch {
        throw new ValidationError('Invalid cursor');
      }
    }

    const posts = await this.postModel.findByUserId(userId, { cursor, limit: limit + 1, includePrivate });
    const hasMore = posts.length > limit;
    const data = hasMore ? posts.slice(0, limit) : posts;

    let nextCursor: string | undefined;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ id: last.id, created_at: last.created_at }),
      ).toString('base64');
    }

    return {
      success: true,
      data,
      cursor: nextCursor,
      hasMore,
      pagination: { hasMore, cursor: nextCursor },
    };
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  async updatePost(id: string, userId: string, dto: UpdatePostDto): Promise<Post> {
    const existing = await this.postModel.findById(id);
    if (!existing) throw new PostNotFoundError(id);
    if (existing.user_id !== userId) throw new PostForbiddenError();

    if (dto.content && dto.content.length > config.POST.MAX_CONTENT_LENGTH) {
      throw new ValidationError(`Content cannot exceed ${config.POST.MAX_CONTENT_LENGTH} characters`);
    }

    try {
      // Save edit history if content changed
      if (dto.content && dto.content !== existing.content) {
        await this.editHistoryModel.create(id, existing.content);
      }

      const updated = await this.postModel.update(id, dto);

      // Re-process hashtags if content changed
      if (dto.content && dto.content !== existing.content) {
        await this.hashtagService.reprocessForPost(id, dto.content);
      }

      // Invalidate caches
      l1Delete(id);
      await this.cacheService.deletePost(id);

      await this.postProducer.publishPostUpdated(updated);
      postMetrics.postsUpdated.inc();
      return updated;
    } catch (error) {
      logger.error('Failed to update post', { error, postId: id });
      throw error;
    }
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────

  async deletePost(id: string, userId: string): Promise<void> {
    const existing = await this.postModel.findById(id);
    if (!existing) throw new PostNotFoundError(id);
    if (existing.user_id !== userId) throw new PostForbiddenError();

    try {
      await this.postModel.softDelete(id);
      await this.hashtagService.reprocessForPost(id, ''); // decrement hashtag counts
      l1Delete(id);
      await this.cacheService.deletePost(id);
      await this.postProducer.publishPostDeleted(id, userId);
      postMetrics.postsDeleted.inc();
    } catch (error) {
      logger.error('Failed to delete post', { error, postId: id });
      throw error;
    }
  }

  // ─── ADMIN / CONSUMER ────────────────────────────────────────────────────

  async deleteAllPostsByUser(userId: string): Promise<void> {
    const count = await this.postModel.softDeleteAllByUser(userId);
    logger.info('All posts soft-deleted for user', { userId, count });
  }

  async updateModerationStatus(postId: string, status: string): Promise<void> {
    await this.postModel.updateModerationStatus(postId, status);
    l1Delete(postId);
    await this.cacheService.deletePost(postId);
  }

  async getEditHistory(postId: string, requesterId: string): Promise<unknown[]> {
    const post = await this.getPost(postId, requesterId);
    // Edit history is owner-only — even if the post is PUBLIC
    if (post.user_id !== requesterId) {
      throw new PostForbiddenError();
    }
    return this.editHistoryModel.findByPostId(postId);
  }
}
