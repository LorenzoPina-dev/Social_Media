/**
 * FeedService
 *
 * Manages personalised feeds stored in Redis ZSETs.
 *
 * Key schema:
 *   feed:{userId}   ZSET — personal feed (own posts + followed users' posts)
 *   feed:public     ZSET — global public feed (all PUBLIC posts from every user)
 *
 * Score formula: timestampMs + engagementBoost
 *   where engagementBoost = (likeCount * 10 + commentCount * 20 + shareCount * 30)
 *   capped at 86_400_000 ms (1 day) to limit how much engagement can shift a post.
 *
 * Fan-out strategy:
 *   • PRIVATE posts   → saved to store + added to author's own feed only (no fan-out).
 *   • FOLLOWERS posts → fan-out on WRITE to followers + author.
 *   • PUBLIC posts    → fan-out on WRITE to followers + author + added to feed:public.
 *   • Celebrity users (> CELEBRITY_THRESHOLD followers) → fan-out on READ
 *     (posts are NOT pushed to individual feeds; the read endpoint merges them).
 *
 * Read strategy:
 *   getFeed merges feed:{userId} + feed:public in-process, deduplicates by postId
 *   (keeping the highest score), and returns the unified sorted result.
 *   This guarantees:
 *     1. All of the viewer's own posts (any visibility).
 *     2. FOLLOWERS posts from users the viewer follows.
 *     3. PUBLIC posts from every user on the platform.
 */

import { getRedisClient } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import { storeService } from './store.service';
import { fetchUserProfilesByIds } from './http.service';
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

  /** Global ZSET that holds all PUBLIC posts (every author). */
  private publicFeedKey(): string {
    return 'feed:public';
  }

  // ── Write operations ─────────────────────────────────────────────────────────

  /**
   * Add a PUBLIC post to the global public feed ZSET.
   * Called by post.consumer after saving a PUBLIC post.
   */
  async addPostToPublicFeed(postId: string, score: number): Promise<void> {
    const redis = getRedisClient();
    const key = this.publicFeedKey();

    await redis.zadd(key, score, postId);

    // Keep the global feed trimmed (allow 10× the per-user max size)
    const size = await redis.zcard(key);
    const globalMax = config.FEED.MAX_SIZE * 10;
    if (size > globalMax) {
      await redis.zremrangebyrank(key, 0, size - globalMax - 1);
    }

    await redis.expire(key, config.FEED.TTL_SECONDS);
    logger.debug('FeedService: post added to public feed', { postId });
  }

  /**
   * Remove a post from the global public feed (called on post_deleted).
   */
  async removePostFromPublicFeed(postId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.zrem(this.publicFeedKey(), postId);
    logger.debug('FeedService: post removed from public feed', { postId });
  }

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
   * Read a paginated slice of a user's unified feed.
   *
   * The unified feed is the in-process merge of:
   *   • feed:{userId}  — personal ZSET (own posts of any visibility + followed users' posts)
   *   • feed:public    — global ZSET   (PUBLIC posts from every user on the platform)
   *
   * After merging and deduplicating (highest score wins for duplicates) the result
   * is sorted descending by score so the most recent / most engaged posts appear first.
   *
   * Cursor pagination works identically to the single-ZSET variant: the cursor
   * encodes the score of the last returned item and is used as an exclusive upper
   * bound on the next call.
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
    const personalKey = this.feedKey(userId);
    const publicKey = this.publicFeedKey();

    const safeLimit = Math.min(limit, config.FEED.MAX_PAGE_SIZE);
    // Fetch one extra from each source so we can detect if there are more pages
    // after the merge (in the worst case all items overlap, so safeLimit+1 each
    // is sufficient to guarantee correct hasMore detection).
    const fetchCount = safeLimit + 1;

    // Decode cursor: contains the max score (exclusive) for this page
    let maxScore = '+inf';
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const parsed = parseFloat(decoded);
        if (!isNaN(parsed)) {
          maxScore = String(parsed - 1);
        }
      } catch {
        // ignore invalid cursors — start from the top
      }
    }

    // Fetch from both ZSETs in parallel
    const [personalRaw, publicRaw] = await Promise.all([
      redis.zrevrangebyscore(personalKey, maxScore, '-inf', 'WITHSCORES', 'LIMIT', 0, fetchCount),
      redis.zrevrangebyscore(publicKey,   maxScore, '-inf', 'WITHSCORES', 'LIMIT', 0, fetchCount),
    ]);

    // Parse helper: [member, score, member, score, …] → FeedEntry[]
    const parseRaw = (raw: string[]): FeedEntry[] => {
      const out: FeedEntry[] = [];
      for (let i = 0; i < raw.length; i += 2) {
        out.push({ postId: raw[i], score: parseFloat(raw[i + 1]) });
      }
      return out;
    };

    // Merge & deduplicate — keep the highest score for posts present in both ZSETs
    const scoreMap = new Map<string, number>();
    for (const entry of [...parseRaw(personalRaw), ...parseRaw(publicRaw)]) {
      const existing = scoreMap.get(entry.postId);
      if (existing === undefined || entry.score > existing) {
        scoreMap.set(entry.postId, entry.score);
      }
    }

    // Sort descending by score (newest / most-engaged first)
    const sorted: FeedEntry[] = [...scoreMap.entries()]
      .map(([postId, score]) => ({ postId, score }))
      .sort((a, b) => b.score - a.score);

    const hasMore = sorted.length > safeLimit;
    const page = hasMore ? sorted.slice(0, safeLimit) : sorted;

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
   * Hydrate feed entries with full post details and author info.
   *
   * Data is read entirely from Redis (denormalized by Kafka consumers) —
   * zero downstream HTTP calls on the read path.
   *
   * Strategy:
   *  1. Batch-fetch all post hashes from Redis (post_data:{postId}).
   *  2. Collect unique author IDs from the fetched posts.
   *  3. Batch-fetch all user profile hashes from Redis (user_profile:{userId}).
   *  4. Assemble FeedItem objects.
   *
   * Posts missing from Redis (deleted, never stored) are silently dropped.
   */
  async hydrateFeedEntries(entries: FeedEntry[]): Promise<FeedItem[]> {
    if (entries.length === 0) return [];

    const postIds = entries.map((e) => e.postId);

    // Step 1 — batch read post hashes from Redis
    const postMap = await storeService.getPosts(postIds);

    if (postMap.size === 0) {
      logger.warn('hydrateFeedEntries: no post data found in Redis', { count: postIds.length });
      return [];
    }

    // Step 2 — collect unique author IDs from the posts we found
    const authorIds = [...new Set([...postMap.values()].map((p) => p.userId))];

    // Step 3 — batch read user profile hashes from Redis
    let userMap = await storeService.getUserProfiles(authorIds);

    // Step 3b — FALLBACK: for any author missing from Redis, fetch from user-service
    //            and write-through to Redis so the next request is cache-only.
    //            This covers users who registered before the denormalization system
    //            was introduced (no user_created event ever stored their profile).
    const missingAuthorIds = authorIds.filter((id) => !userMap.has(id));
    if (missingAuthorIds.length > 0) {
      logger.info('hydrateFeedEntries: profiles missing from Redis, fetching via HTTP', {
        missing: missingAuthorIds.length,
        total: authorIds.length,
      });

      const fetchedProfiles = await fetchUserProfilesByIds(missingAuthorIds);

      if (fetchedProfiles.size > 0) {
        // Write fetched profiles to Redis (non-blocking — fire and forget)
        void Promise.allSettled(
          [...fetchedProfiles.values()].map((profile) =>
            storeService.saveUserProfile({
              id: profile.id,
              username: profile.username,
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl || null,
              verified: profile.verified === '1',
              bio: profile.bio,
            }),
          ),
        ).then(() => {
          logger.debug('hydrateFeedEntries: wrote fallback profiles to Redis', {
            count: fetchedProfiles.size,
          });
        });

        // Merge fetched into the userMap for this request
        userMap = new Map([...userMap, ...fetchedProfiles]);
      }
    }

    // Step 4 — assemble FeedItems
    const items: FeedItem[] = [];
    for (const entry of entries) {
      const stored = postMap.get(entry.postId);
      if (!stored) continue; // post deleted or evicted — skip

      const storedUser = userMap.get(stored.userId);

      items.push({
        postId: entry.postId,
        score: entry.score,
        post: {
          id: stored.id,
          userId: stored.userId,
          content: stored.content,
          imageUrl: this.parseJsonArray(stored.mediaUrls)[0] ?? null,
          imageType: this.parseJsonArray(stored.mediaTypes)[0] ?? null,
          mediaUrls: this.parseJsonArray(stored.mediaUrls),
          mediaTypes: this.parseJsonArray(stored.mediaTypes),
          visibility: stored.visibility,
          likeCount: parseInt(stored.likeCount ?? '0', 10),
          commentCount: parseInt(stored.commentCount ?? '0', 10),
          shareCount: parseInt(stored.shareCount ?? '0', 10),
          publishedAt: stored.publishedAt,
          createdAt: stored.createdAt,
          author: storedUser
            ? {
                id: storedUser.id,
                username: storedUser.username,
                displayName: storedUser.displayName,
                avatarUrl: storedUser.avatarUrl || null,
                verified: storedUser.verified === '1',
              }
            : null,
        },
      });
    }

    return items;
  }

  /** Safe JSON.parse for stored arrays */
  private parseJsonArray(raw: string | undefined): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export const feedService = new FeedService();
export default feedService;
