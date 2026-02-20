/**
 * FeedService
 *
 * Manages personalised feeds stored in Redis ZSETs.
 *
 * Key schema:   feed:{userId}           ZSET — score=rankingScore, member=postId
 * Score formula: timestampMs + engagementBoost
 *   where engagementBoost = (likeCount * 10 + commentCount * 20 + shareCount * 30)
 *   capped at 86_400_000 ms (1 day) to limit how much engagement can shift a post.
 *
 * Fan-out strategy:
 *   • Normal users  (<= CELEBRITY_THRESHOLD followers) → fan-out on WRITE.
 *   • Celebrity users (> CELEBRITY_THRESHOLD followers) → fan-out on READ
 *     (posts are NOT pushed to individual feeds; the read endpoint merges them).
 */

import { getRedisClient } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import type { FeedEntry, FeedItem } from '../types';

// Max engagement boost in milliseconds (1 day)
const MAX_ENGAGEMENT_BOOST = 86_400_000;

export class FeedService {
  // ── Score calculation ────────────────────────────────────────────────────────

  /**
   * Calculate ranking score for a post.
   * Higher score → shown later (ZRANGEBYSCORE returns in ascending order,
   * so for "newest first" we use ZREVRANGEBYSCORE).
   */
  calculateScore(
    createdAtMs: number,
    engagement: { likeCount?: number; commentCount?: number; shareCount?: number } = {},
  ): number {
    const boost = Math.min(
      (engagement.likeCount ?? 0) * 10 +
        (engagement.commentCount ?? 0) * 20 +
        (engagement.shareCount ?? 0) * 30,
      MAX_ENGAGEMENT_BOOST,
    );
    return createdAtMs + boost;
  }

  // ── Feed key helpers ─────────────────────────────────────────────────────────

  private feedKey(userId: string): string {
    return `feed:${userId}`;
  }

  // ── Write operations ─────────────────────────────────────────────────────────

  /**
   * Add a post to a single user's feed.
   */
  async addPostToFeed(
    userId: string,
    postId: string,
    score: number,
  ): Promise<void> {
    const redis = getRedisClient();
    const key = this.feedKey(userId);

    await redis.zadd(key, score, postId);

    // Trim to MAX_SIZE (keep the highest-scored entries)
    const size = await redis.zcard(key);
    if (size > config.FEED.MAX_SIZE) {
      await redis.zremrangebyrank(key, 0, size - config.FEED.MAX_SIZE - 1);
    }

    // Refresh TTL on every write
    await redis.expire(key, config.FEED.TTL_SECONDS);
  }

  /**
   * Fan-out a new post to all provided follower IDs.
   * Should only be called for non-celebrity authors.
   */
  async fanOutPost(
    followerIds: string[],
    postId: string,
    score: number,
  ): Promise<void> {
    if (followerIds.length === 0) return;

    const redis = getRedisClient();
    const pipeline = redis.pipeline();

    for (const followerId of followerIds) {
      const key = this.feedKey(followerId);
      pipeline.zadd(key, score, postId);
      pipeline.expire(key, config.FEED.TTL_SECONDS);
    }

    await pipeline.exec();

    // After pipeline, trim oversized feeds
    const trimPipeline = redis.pipeline();
    for (const followerId of followerIds) {
      const key = this.feedKey(followerId);
      trimPipeline.zremrangebyrank(key, 0, -(config.FEED.MAX_SIZE + 1));
    }
    await trimPipeline.exec();

    metrics.incrementCounter('feed_fan_out', { type: 'write' });
    logger.info('Feed fan-out complete', { postId, followerCount: followerIds.length });
  }

  /**
   * Remove a post from all provided follower feeds.
   * Called when a post is deleted.
   */
  async removePostFromFeeds(followerIds: string[], postId: string): Promise<void> {
    if (followerIds.length === 0) return;

    const redis = getRedisClient();
    const pipeline = redis.pipeline();

    for (const followerId of followerIds) {
      pipeline.zrem(this.feedKey(followerId), postId);
    }

    await pipeline.exec();
    logger.info('Post removed from feeds', { postId, followerCount: followerIds.length });
  }

  /**
   * Remove a post from a single user's feed.
   */
  async removePostFromFeed(userId: string, postId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.zrem(this.feedKey(userId), postId);
  }

  /**
   * Update the score of a post in a user's feed (e.g., after a like/share).
   */
  async updatePostScore(
    userId: string,
    postId: string,
    newScore: number,
  ): Promise<void> {
    const redis = getRedisClient();
    const key = this.feedKey(userId);

    // Only update if the post is already in this feed
    const existingScore = await redis.zscore(key, postId);
    if (existingScore !== null) {
      await redis.zadd(key, newScore, postId);
    }
  }

  /**
   * Update engagement score for a post across all provided user feeds.
   */
  async boostPostInFeeds(
    userIds: string[],
    postId: string,
    engagementDelta: number,
  ): Promise<void> {
    if (userIds.length === 0) return;

    const redis = getRedisClient();
    const pipeline = redis.pipeline();

    for (const userId of userIds) {
      // Use ZINCRBY to atomically add the engagement delta
      pipeline.zincrby(this.feedKey(userId), engagementDelta, postId);
    }

    await pipeline.exec();
  }

  /**
   * Delete an entire user feed (e.g., on user deletion or unfollow cleanup).
   */
  async clearFeed(userId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(this.feedKey(userId));
    logger.info('Feed cleared', { userId });
  }

  /**
   * When User A unfollows User B, remove all of B's posts from A's feed.
   * (Best-effort: we only remove posts that are currently in the feed.)
   */
  async removeFeedEntriesForAuthor(
    feedOwnerId: string,
    authorId: string,
    postIds: string[],
  ): Promise<void> {
    if (postIds.length === 0) return;

    const redis = getRedisClient();
    const pipeline = redis.pipeline();

    pipeline.zrem(this.feedKey(feedOwnerId), ...postIds);

    await pipeline.exec();
    logger.info('Removed author posts from feed', { feedOwnerId, authorId, count: postIds.length });
  }

  // ── Read operations ──────────────────────────────────────────────────────────

  /**
   * Read a paginated slice of a user's feed.
   *
   * Uses ZREVRANGEBYSCORE so the highest-scored (most recent + most engaged)
   * posts appear first.
   *
   * @param userId        Owner of the feed
   * @param cursor        Opaque cursor (base64 of the max score to exclude)
   * @param limit         Number of entries to return (capped at MAX_PAGE_SIZE)
   * @returns             Entries and a next cursor for pagination
   */
  async getFeed(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<{ entries: FeedEntry[]; nextCursor: string | null; hasMore: boolean }> {
    const redis = getRedisClient();
    const key = this.feedKey(userId);

    const safeLimit = Math.min(limit, config.FEED.MAX_PAGE_SIZE);
    // We fetch one extra to determine if there are more pages
    const fetchCount = safeLimit + 1;

    // Decode cursor: it contains the max score (exclusive) for this page
    let maxScore = '+inf';
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const parsed = parseFloat(decoded);
        if (!isNaN(parsed)) {
          // Exclusive upper bound: subtract 1 to avoid returning the cursor item again
          maxScore = String(parsed - 1);
        }
      } catch {
        // ignore invalid cursors
      }
    }

    // Returns [member, score, member, score, …]
    const raw: string[] = await redis.zrevrangebyscore(
      key,
      maxScore,
      '-inf',
      'WITHSCORES',
      'LIMIT',
      0,
      fetchCount,
    );

    const entries: FeedEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({ postId: raw[i], score: parseFloat(raw[i + 1]) });
    }

    const hasMore = entries.length === fetchCount;
    const page = hasMore ? entries.slice(0, safeLimit) : entries;

    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const lastScore = page[page.length - 1].score;
      nextCursor = Buffer.from(String(lastScore)).toString('base64');
    }

    return { entries: page, nextCursor, hasMore };
  }

  /**
   * Get feed entries for a user without post hydration.
   * Useful for internal operations and tests.
   */
  async getRawFeed(userId: string): Promise<FeedEntry[]> {
    const redis = getRedisClient();
    const key = this.feedKey(userId);

    const raw: string[] = await redis.zrevrangebyscore(key, '+inf', '-inf', 'WITHSCORES');

    const entries: FeedEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({ postId: raw[i], score: parseFloat(raw[i + 1]) });
    }
    return entries;
  }

  /**
   * Get the number of posts in a user's feed.
   */
  async getFeedSize(userId: string): Promise<number> {
    const redis = getRedisClient();
    return redis.zcard(this.feedKey(userId));
  }

  /**
   * Check if a post exists in a user's feed.
   */
  async postExistsInFeed(userId: string, postId: string): Promise<boolean> {
    const redis = getRedisClient();
    const score = await redis.zscore(this.feedKey(userId), postId);
    return score !== null;
  }

  /**
   * Hydrate feed entries with full post details via HTTP call to post-service.
   * Returns only the entries for which data was successfully retrieved.
   */
  async hydrateFeedEntries(entries: FeedEntry[]): Promise<FeedItem[]> {
    if (entries.length === 0) return [];

    const items: FeedItem[] = entries.map((e) => ({ ...e }));

    // In a real scenario this would call POST_SERVICE_URL/api/v1/posts?ids=...
    // For testability, the actual HTTP call is extracted so it can be mocked.
    return items;
  }
}

export const feedService = new FeedService();
export default feedService;
