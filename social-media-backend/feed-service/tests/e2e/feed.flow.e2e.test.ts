/**
 * E2E flow tests for feed-service
 *
 * These tests simulate the full lifecycle of a feed by directly calling the
 * Kafka consumer handlers and then verifying the feed state via HTTP endpoints.
 * All external services (user-service, post-service, Kafka broker) are mocked.
 *
 * Prerequisites: Redis mock (in-memory), JWT mock, no real infrastructure needed.
 */

import request from 'supertest';
import { Application } from 'express';
import { redisMock } from '../__mocks__/redis.mock';
import { VALID_JWT_USER_ID, createPostId, createUserId } from '../fixtures';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../src/config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
  getRedisClient: jest.fn(() => redisMock),
  disconnectRedis: jest.fn(),
}));

jest.mock('../../src/config/kafka', () => ({
  connectKafka: jest.fn().mockResolvedValue(undefined),
  disconnectKafka: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../src/utils/metrics', () => ({
  metrics: { incrementCounter: jest.fn(), setFeedSize: jest.fn(), recordRequestDuration: jest.fn() },
  startMetricsServer: jest.fn(),
}));

const mockFetchFollowerIds = jest.fn();
const mockFetchUserRecentPostIds = jest.fn();

jest.mock('../../src/services/http.service', () => ({
  fetchFollowerIds: mockFetchFollowerIds,
  fetchUserRecentPostIds: mockFetchUserRecentPostIds,
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({
    userId: VALID_JWT_USER_ID,
    email: 'e2e@test.com',
    iat: 1000,
    exp: 9999999999,
  }),
}));

// ── App setup ────────────────────────────────────────────────────────────────

let app: Application;

beforeAll(async () => {
  const { createApp } = await import('../../src/app');
  app = await createApp();
});

beforeEach(() => {
  redisMock.flushAll();
  jest.clearAllMocks();
  mockFetchFollowerIds.mockResolvedValue({ followerIds: [VALID_JWT_USER_ID], followerCount: 1 });
  mockFetchUserRecentPostIds.mockResolvedValue([]);
});

const AUTH = { Authorization: 'Bearer valid.token' };

// ─────────────────────────────────────────────────────────────────────────────

describe('E2E Flow: Post Created → Appears in Feed', () => {
  it('When a post is created and fan-out runs, the post appears in the follower\'s feed', async () => {
    const { handlePostEvent } = await import('../../src/kafka/consumers/post.consumer');

    const postId = createPostId();
    const authorId = createUserId();

    // Simulate fan-out: VALID_JWT_USER_ID follows authorId
    mockFetchFollowerIds.mockResolvedValue({
      followerIds: [VALID_JWT_USER_ID],
      followerCount: 1,
    });

    const event = {
      type: 'post_created',
      entityId: postId,
      userId: authorId,
      timestamp: new Date().toISOString(),
      payload: { userId: authorId, content: 'Hello world!', hashtags: [], visibility: 'PUBLIC' },
    };

    // Simulate Kafka event
    await handlePostEvent(event as any);

    // Feed should now contain the post
    const feedRes = await request(app).get('/api/v1/feed').set(AUTH);

    expect(feedRes.status).toBe(200);
    expect(feedRes.body.data.items.some((item: any) => item.postId === postId)).toBe(true);
  });
});

describe('E2E Flow: Post Deleted → Removed from Feed', () => {
  it('When a post is deleted, it is removed from the follower\'s feed', async () => {
    const { handlePostEvent } = await import('../../src/kafka/consumers/post.consumer');

    const postId = createPostId();

    // Pre-seed feed
    await redisMock.zadd(`feed:${VALID_JWT_USER_ID}`, Date.now(), postId);

    const deleteEvent = {
      type: 'post_deleted',
      entityId: postId,
      userId: createUserId(),
      timestamp: new Date().toISOString(),
      payload: { userId: VALID_JWT_USER_ID },
    };

    await handlePostEvent(deleteEvent as any);

    const feedRes = await request(app).get('/api/v1/feed').set(AUTH);
    expect(feedRes.body.data.items.some((item: any) => item.postId === postId)).toBe(false);
  });
});

describe('E2E Flow: Like → Score Boosted → Post Moves Up', () => {
  it('When a post is liked, its score increases and it is ranked higher', async () => {
    const { handleInteractionEvent } = await import('../../src/kafka/consumers/interaction.consumer');

    const highPostId = createPostId();
    const lowPostId = createPostId();

    const now = Date.now();
    await redisMock.zadd(`feed:${VALID_JWT_USER_ID}`, now, highPostId);
    await redisMock.zadd(`feed:${VALID_JWT_USER_ID}`, now - 5000, lowPostId);

    // Like the older (lower-scored) post — it should move up
    mockFetchFollowerIds.mockResolvedValue({
      followerIds: [VALID_JWT_USER_ID],
      followerCount: 1,
    });

    const likeEvent = {
      type: 'like_created',
      entityId: lowPostId,
      userId: createUserId(),
      timestamp: new Date().toISOString(),
      payload: { targetType: 'POST' },
    };

    await handleInteractionEvent(likeEvent as any);

    const scoreHigh = parseFloat((await redisMock.zscore(`feed:${VALID_JWT_USER_ID}`, highPostId)) || '0');
    const scoreLow = parseFloat((await redisMock.zscore(`feed:${VALID_JWT_USER_ID}`, lowPostId)) || '0');

    // lowPostId score has been boosted by 10 (LIKE_DELTA)
    expect(scoreLow).toBe(now - 5000 + 10);
    // Gap reduced (highPostId is now only 4990 points ahead instead of 5000)
    expect(scoreHigh - scoreLow).toBe(4990);
  });
});

describe('E2E Flow: Follow → Seed Feed → Unfollow → Clean Feed', () => {
  it('Following seeds the new follower\'s feed; unfollowing cleans it', async () => {
    const { handleUserEvent } = await import('../../src/kafka/consumers/user.consumer');

    const followerId = VALID_JWT_USER_ID;
    const followingId = createUserId();
    const postId = createPostId();

    // Simulate follow: seed recent posts
    mockFetchUserRecentPostIds.mockResolvedValue([postId]);

    const followEvent = {
      type: 'follow_created',
      entityId: followerId,
      userId: followerId,
      timestamp: new Date().toISOString(),
      payload: { followingId },
    };

    await handleUserEvent(followEvent as any);

    // Feed should contain the followed user's post
    let feedRes = await request(app).get('/api/v1/feed').set(AUTH);
    expect(feedRes.body.data.items.some((i: any) => i.postId === postId)).toBe(true);

    // Simulate unfollow
    mockFetchUserRecentPostIds.mockResolvedValue([postId]);
    mockFetchFollowerIds.mockResolvedValue({ followerIds: [followerId], followerCount: 1 });

    const unfollowEvent = {
      type: 'follow_deleted',
      entityId: followerId,
      userId: followerId,
      timestamp: new Date().toISOString(),
      payload: { followingId },
    };

    await handleUserEvent(unfollowEvent as any);

    // Post should be removed from feed
    feedRes = await request(app).get('/api/v1/feed').set(AUTH);
    expect(feedRes.body.data.items.some((i: any) => i.postId === postId)).toBe(false);
  });
});

describe('E2E Flow: User Deleted → Feed Cleared', () => {
  it('When a user account is deleted, their feed is cleared', async () => {
    const { handleUserEvent } = await import('../../src/kafka/consumers/user.consumer');

    const userId = VALID_JWT_USER_ID;
    const postId = createPostId();

    await redisMock.zadd(`feed:${userId}`, 100, postId);

    expect(await redisMock.zcard(`feed:${userId}`)).toBe(1);

    const event = {
      type: 'user_deleted',
      entityId: userId,
      userId,
      timestamp: new Date().toISOString(),
      payload: { username: 'deletedUser' },
    };

    await handleUserEvent(event as any);

    expect(await redisMock.zcard(`feed:${userId}`)).toBe(0);
  });
});

describe('E2E Flow: Pagination across multiple pages', () => {
  it('should retrieve all 30 posts across 3 pages of 10', async () => {
    const userId = VALID_JWT_USER_ID;

    for (let i = 1; i <= 30; i++) {
      await redisMock.zadd(`feed:${userId}`, i * 1000, `post-${String(i).padStart(2, '0')}`);
    }

    let cursor: string | null = null;
    const allPostIds: string[] = [];
    let pageCount = 0;

    do {
      const url: string = cursor
        ? `/api/v1/feed?limit=10&cursor=${encodeURIComponent(cursor)}`
        : '/api/v1/feed?limit=10';

      const res = await request(app).get(url).set(AUTH);

      expect(res.status).toBe(200);
      const { items, nextCursor, hasMore } = res.body.data;

      items.forEach((item: any) => allPostIds.push(item.postId));
      cursor = nextCursor;
      pageCount++;

      if (!hasMore) break;
    } while (cursor && pageCount < 10);

    expect(allPostIds).toHaveLength(30);
    // No duplicates
    expect(new Set(allPostIds).size).toBe(30);
    expect(pageCount).toBe(3);
  });
});

describe('E2E Flow: Clear feed via API', () => {
  it('DELETE /api/v1/feed clears the feed and subsequent GET returns empty', async () => {
    const userId = VALID_JWT_USER_ID;

    await redisMock.zadd(`feed:${userId}`, 100, 'post1');
    await redisMock.zadd(`feed:${userId}`, 200, 'post2');

    const deleteRes = await request(app).delete('/api/v1/feed').set(AUTH);
    expect(deleteRes.status).toBe(200);

    const getRes = await request(app).get('/api/v1/feed').set(AUTH);
    expect(getRes.body.data.items).toHaveLength(0);
    expect(getRes.body.data.hasMore).toBe(false);
  });
});
