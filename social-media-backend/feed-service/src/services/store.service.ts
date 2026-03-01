/**
 * StoreService
 *
 * Manages denormalized data in Redis for zero-latency feed hydration.
 * Data is written when Kafka events arrive (post_created, user_updated, etc.)
 * and read at feed-render time — no downstream HTTP calls needed.
 *
 * Key schema:
 *   post_data:{postId}    → Redis Hash  (post fields for rendering)
 *   user_profile:{userId} → Redis Hash  (author fields for rendering)
 *
 * TTLs:
 *   post_data:    7 days  (posts rarely needed after a week if already scrolled past)
 *   user_profile: 30 days (refreshed on every user_updated event)
 */

import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

const POST_DATA_TTL = 7 * 24 * 3600;   // 7 days
const USER_PROFILE_TTL = 30 * 24 * 3600; // 30 days

// ── Stored shapes ─────────────────────────────────────────────────────────────

export interface StoredPost {
  id: string;
  userId: string;
  content: string;
  mediaUrls: string;   // JSON array stored as string
  mediaTypes: string;  // JSON array stored as string
  visibility: string;
  likeCount: string;
  commentCount: string;
  shareCount: string;
  publishedAt: string;
  createdAt: string;
}

export interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  verified: string;    // '0' | '1'
  bio: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function postKey(postId: string): string {
  return `post_data:${postId}`;
}

function userKey(userId: string): string {
  return `user_profile:${userId}`;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class StoreService {
  // ── Post store ─────────────────────────────────────────────────────────────

  /**
   * Persist all fields needed to render a post card in the feed.
   * Called by post.consumer on post_created.
   */
  async savePost(data: {
    id: string;
    userId: string;
    content: string;
    mediaUrls: string[];
    mediaTypes: string[];
    visibility: string;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    publishedAt: string;
    createdAt: string;
  }): Promise<void> {
    const redis = getRedisClient();
    const key = postKey(data.id);

    await redis.hmset(key, {
      id: data.id,
      userId: data.userId,
      content: data.content,
      mediaUrls: JSON.stringify(data.mediaUrls),
      mediaTypes: JSON.stringify(data.mediaTypes),
      visibility: data.visibility,
      likeCount: String(data.likeCount),
      commentCount: String(data.commentCount),
      shareCount: String(data.shareCount),
      publishedAt: data.publishedAt,
      createdAt: data.createdAt,
    });

    await redis.expire(key, POST_DATA_TTL);
    logger.debug('StoreService: post saved', { postId: data.id });
  }

  /**
   * Partially update post fields (content / visibility / media) on post_updated.
   */
  async updatePost(postId: string, patch: {
    content?: string;
    visibility?: string;
    mediaUrls?: string[];
    mediaTypes?: string[];
  }): Promise<void> {
    const redis = getRedisClient();
    const key = postKey(postId);

    // Only update if the key already exists
    const exists = await redis.exists(key);
    if (!exists) return;

    const fields: Record<string, string> = {};
    if (patch.content !== undefined) fields.content = patch.content;
    if (patch.visibility !== undefined) fields.visibility = patch.visibility;
    if (patch.mediaUrls !== undefined) fields.mediaUrls = JSON.stringify(patch.mediaUrls);
    if (patch.mediaTypes !== undefined) fields.mediaTypes = JSON.stringify(patch.mediaTypes);

    if (Object.keys(fields).length > 0) {
      await redis.hmset(key, fields);
      await redis.expire(key, POST_DATA_TTL); // renew TTL on update
    }
  }

  /**
   * Atomically increment/decrement a counter field on a post.
   * Used by interaction.consumer (like, comment, share events).
   */
  async adjustPostCounter(
    postId: string,
    field: 'likeCount' | 'commentCount' | 'shareCount',
    delta: number,
  ): Promise<void> {
    const redis = getRedisClient();
    const key = postKey(postId);

    const exists = await redis.exists(key);
    if (!exists) return; // post not in store — skip

    await redis.hincrbyfloat(key, field, delta);
    // Clamp to 0 to avoid negative counters
    const current = parseFloat((await redis.hget(key, field)) ?? '0');
    if (current < 0) {
      await redis.hset(key, field, '0');
    }
  }

  /**
   * Delete post data when post is deleted.
   */
  async deletePost(postId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(postKey(postId));
  }

  /**
   * Fetch post data by ID. Returns null if not found.
   */
  async getPost(postId: string): Promise<StoredPost | null> {
    const redis = getRedisClient();
    const data = await redis.hgetall(postKey(postId));
    if (!data || !data.id) return null;
    return data as unknown as StoredPost;
  }

  /**
   * Batch-fetch post data for multiple IDs.
   * Returns a Map<postId, StoredPost> — missing entries are absent.
   */
  async getPosts(postIds: string[]): Promise<Map<string, StoredPost>> {
    if (postIds.length === 0) return new Map();

    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    for (const id of postIds) {
      pipeline.hgetall(postKey(id));
    }

    const results = await pipeline.exec();
    const map = new Map<string, StoredPost>();

    if (!results) return map;

    for (let i = 0; i < postIds.length; i++) {
      const [err, data] = results[i] as [Error | null, Record<string, string> | null];
      if (!err && data && data.id) {
        map.set(postIds[i], data as unknown as StoredPost);
      }
    }

    return map;
  }

  // ── User profile store ─────────────────────────────────────────────────────

  /**
   * Persist all fields needed to render an author avatar/name in the feed.
   * Called by user.consumer on user_created and user_updated.
   */
  async saveUserProfile(data: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    verified?: boolean;
    bio?: string;
  }): Promise<void> {
    const redis = getRedisClient();
    const key = userKey(data.id);

    await redis.hmset(key, {
      id: data.id,
      username: data.username,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl ?? '',
      verified: data.verified ? '1' : '0',
      bio: data.bio ?? '',
    });

    await redis.expire(key, USER_PROFILE_TTL);
    logger.debug('StoreService: user profile saved', { userId: data.id });
  }

  /**
   * Delete user profile when user is deleted.
   */
  async deleteUserProfile(userId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(userKey(userId));
  }

  /**
   * Batch-fetch user profiles for multiple IDs.
   * Returns a Map<userId, StoredUser> — missing entries are absent.
   */
  async getUserProfiles(userIds: string[]): Promise<Map<string, StoredUser>> {
    if (userIds.length === 0) return new Map();

    const uniqueIds = [...new Set(userIds)];
    const redis = getRedisClient();
    const pipeline = redis.pipeline();
    for (const id of uniqueIds) {
      pipeline.hgetall(userKey(id));
    }

    const results = await pipeline.exec();
    const map = new Map<string, StoredUser>();

    if (!results) return map;

    for (let i = 0; i < uniqueIds.length; i++) {
      const [err, data] = results[i] as [Error | null, Record<string, string> | null];
      if (!err && data && data.id) {
        map.set(uniqueIds[i], data as unknown as StoredUser);
      }
    }

    return map;
  }
}

export const storeService = new StoreService();
export default storeService;
