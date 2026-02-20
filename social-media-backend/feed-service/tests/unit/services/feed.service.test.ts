/**
 * Unit tests for FeedService
 *
 * All Redis calls are handled by the in-memory RedisMock.
 */

import { redisMock } from '../../__mocks__/redis.mock';

// Apply mocks BEFORE importing the module under test
jest.mock('../../../src/config/redis', () => ({
  getRedisClient: jest.fn(() => redisMock),
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/utils/metrics', () => ({
  metrics: { incrementCounter: jest.fn(), setFeedSize: jest.fn() },
}));

import { FeedService } from '../../../src/services/feed.service';

describe('FeedService', () => {
  let service: FeedService;

  beforeEach(() => {
    service = new FeedService();
    redisMock.flushAll();
  });

  // ── calculateScore ──────────────────────────────────────────────────────────

  describe('calculateScore', () => {
    it('should return the timestamp when there is no engagement', () => {
      const ts = 1_700_000_000_000;
      expect(service.calculateScore(ts)).toBe(ts);
    });

    it('should add engagement boost to timestamp', () => {
      const ts = 1_700_000_000_000;
      const score = service.calculateScore(ts, { likeCount: 1, commentCount: 0, shareCount: 0 });
      expect(score).toBe(ts + 10);
    });

    it('should weight likes=10, comments=20, shares=30', () => {
      const ts = 1_000_000;
      const score = service.calculateScore(ts, { likeCount: 2, commentCount: 3, shareCount: 1 });
      // 2*10 + 3*20 + 1*30 = 20 + 60 + 30 = 110
      expect(score).toBe(ts + 110);
    });

    it('should cap engagement boost at 86_400_000', () => {
      const ts = 1_000_000;
      // Huge engagement
      const score = service.calculateScore(ts, {
        likeCount: 9_999_999,
        commentCount: 9_999_999,
        shareCount: 9_999_999,
      });
      expect(score).toBe(ts + 86_400_000);
    });

    it('should handle undefined engagement gracefully', () => {
      const ts = 5_000;
      expect(service.calculateScore(ts, {})).toBe(ts);
    });
  });

  // ── addPostToFeed ───────────────────────────────────────────────────────────

  describe('addPostToFeed', () => {
    it('should add postId to feed ZSET with correct score', async () => {
      await service.addPostToFeed('user1', 'post1', 1234);

      const entries = redisMock.getZSetEntries('feed:user1');
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({ member: 'post1', score: 1234 });
    });

    it('should update score if postId already exists in feed', async () => {
      await service.addPostToFeed('user1', 'post1', 100);
      await service.addPostToFeed('user1', 'post1', 200);

      const entries = redisMock.getZSetEntries('feed:user1');
      expect(entries).toHaveLength(1);
      expect(entries[0].score).toBe(200);
    });

    it('should trim feed when it exceeds MAX_SIZE', async () => {
      // Set a very small limit for this test by mocking config
      const originalMax = 1000;
      // Add MAX_SIZE+1 posts
      for (let i = 0; i < originalMax + 1; i++) {
        await redisMock.zadd('feed:userX', i, `post${i}`);
      }
      // Verify that trimming works by calling addPostToFeed
      await service.addPostToFeed('userX', 'postNew', originalMax + 2);

      // Since MAX_SIZE = 1000 and we have 1002 entries, 1 should be trimmed
      const size = await redisMock.zcard('feed:userX');
      expect(size).toBeLessThanOrEqual(originalMax + 1); // trim removes 1
    });

    it('should refresh TTL on every write', async () => {
      const expireSpy = jest.spyOn(redisMock, 'expire');
      await service.addPostToFeed('user1', 'post1', 100);

      expect(expireSpy).toHaveBeenCalledWith('feed:user1', expect.any(Number));
    });
  });

  // ── fanOutPost ──────────────────────────────────────────────────────────────

  describe('fanOutPost', () => {
    it('should add postId to all provided follower feeds', async () => {
      const followers = ['f1', 'f2', 'f3'];
      await service.fanOutPost(followers, 'post1', 999);

      for (const f of followers) {
        const entries = redisMock.getZSetEntries(`feed:${f}`);
        expect(entries.some((e) => e.member === 'post1')).toBe(true);
      }
    });

    it('should be a no-op when follower list is empty', async () => {
      // Should not throw
      await expect(service.fanOutPost([], 'post1', 100)).resolves.toBeUndefined();
    });

    it('should handle large follower lists without error', async () => {
      const followers = Array.from({ length: 500 }, (_, i) => `follower${i}`);
      await expect(service.fanOutPost(followers, 'postBig', 100)).resolves.toBeUndefined();

      const sample = redisMock.getZSetEntries('feed:follower0');
      expect(sample.some((e) => e.member === 'postBig')).toBe(true);
    });
  });

  // ── removePostFromFeeds ─────────────────────────────────────────────────────

  describe('removePostFromFeeds', () => {
    it('should remove the postId from all specified feeds', async () => {
      await redisMock.zadd('feed:u1', 100, 'post1');
      await redisMock.zadd('feed:u2', 100, 'post1');

      await service.removePostFromFeeds(['u1', 'u2'], 'post1');

      expect(await redisMock.zscore('feed:u1', 'post1')).toBeNull();
      expect(await redisMock.zscore('feed:u2', 'post1')).toBeNull();
    });

    it('should be a no-op when user list is empty', async () => {
      await expect(service.removePostFromFeeds([], 'post1')).resolves.toBeUndefined();
    });

    it('should not throw if postId does not exist in some feeds', async () => {
      await redisMock.zadd('feed:u1', 100, 'post1');
      // u2 does NOT have post1
      await expect(service.removePostFromFeeds(['u1', 'u2'], 'post1')).resolves.toBeUndefined();
    });
  });

  // ── removePostFromFeed ──────────────────────────────────────────────────────

  describe('removePostFromFeed', () => {
    it('should remove a single post from a single user feed', async () => {
      await redisMock.zadd('feed:u1', 100, 'postA');
      await redisMock.zadd('feed:u1', 200, 'postB');

      await service.removePostFromFeed('u1', 'postA');

      expect(await redisMock.zscore('feed:u1', 'postA')).toBeNull();
      expect(await redisMock.zscore('feed:u1', 'postB')).not.toBeNull();
    });
  });

  // ── boostPostInFeeds ────────────────────────────────────────────────────────

  describe('boostPostInFeeds', () => {
    it('should increase score by the given delta in all feeds', async () => {
      await redisMock.zadd('feed:u1', 1000, 'post1');
      await redisMock.zadd('feed:u2', 1000, 'post1');

      await service.boostPostInFeeds(['u1', 'u2'], 'post1', 10);

      expect(await redisMock.zscore('feed:u1', 'post1')).toBe('1010');
      expect(await redisMock.zscore('feed:u2', 'post1')).toBe('1010');
    });

    it('should support negative delta (score reduction)', async () => {
      await redisMock.zadd('feed:u1', 1000, 'post1');

      await service.boostPostInFeeds(['u1'], 'post1', -10);

      expect(await redisMock.zscore('feed:u1', 'post1')).toBe('990');
    });

    it('should be a no-op when user list is empty', async () => {
      await expect(service.boostPostInFeeds([], 'post1', 10)).resolves.toBeUndefined();
    });
  });

  // ── clearFeed ───────────────────────────────────────────────────────────────

  describe('clearFeed', () => {
    it('should delete the entire feed for a user', async () => {
      await redisMock.zadd('feed:u1', 100, 'post1');
      await redisMock.zadd('feed:u1', 200, 'post2');

      await service.clearFeed('u1');

      expect(await redisMock.zcard('feed:u1')).toBe(0);
    });

    it('should not throw if feed does not exist', async () => {
      await expect(service.clearFeed('nonexistent')).resolves.toBeUndefined();
    });
  });

  // ── getFeed ─────────────────────────────────────────────────────────────────

  describe('getFeed', () => {
    it('should return an empty result for an empty feed', async () => {
      const result = await service.getFeed('u1', null, 20);

      expect(result.entries).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('should return posts in descending score order', async () => {
      await redisMock.zadd('feed:u1', 100, 'post-low');
      await redisMock.zadd('feed:u1', 300, 'post-high');
      await redisMock.zadd('feed:u1', 200, 'post-mid');

      const { entries } = await service.getFeed('u1', null, 20);

      expect(entries[0].postId).toBe('post-high');
      expect(entries[1].postId).toBe('post-mid');
      expect(entries[2].postId).toBe('post-low');
    });

    it('should respect the limit parameter', async () => {
      for (let i = 1; i <= 10; i++) {
        await redisMock.zadd('feed:u1', i * 100, `post${i}`);
      }

      const { entries, hasMore, nextCursor } = await service.getFeed('u1', null, 5);

      expect(entries).toHaveLength(5);
      expect(hasMore).toBe(true);
      expect(nextCursor).not.toBeNull();
    });

    it('should cap limit at MAX_PAGE_SIZE', async () => {
      for (let i = 1; i <= 60; i++) {
        await redisMock.zadd('feed:u1', i, `post${i}`);
      }

      const { entries } = await service.getFeed('u1', null, 999);

      expect(entries.length).toBeLessThanOrEqual(50);
    });

    it('should paginate correctly using cursor', async () => {
      // Add 6 posts with distinct scores
      for (let i = 1; i <= 6; i++) {
        await redisMock.zadd('feed:u1', i * 1000, `post${i}`);
      }

      const page1 = await service.getFeed('u1', null, 3);
      expect(page1.entries).toHaveLength(3);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await service.getFeed('u1', page1.nextCursor, 3);
      expect(page2.entries.length).toBeGreaterThan(0);

      // No overlap between pages
      const page1Ids = page1.entries.map((e) => e.postId);
      const page2Ids = page2.entries.map((e) => e.postId);
      const intersection = page1Ids.filter((id) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it('should handle invalid cursor gracefully', async () => {
      await redisMock.zadd('feed:u1', 100, 'post1');

      // Should not throw
      const result = await service.getFeed('u1', 'not-valid-base64!!!', 5);
      expect(result.entries.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ── getFeedSize ─────────────────────────────────────────────────────────────

  describe('getFeedSize', () => {
    it('should return 0 for empty feed', async () => {
      expect(await service.getFeedSize('u1')).toBe(0);
    });

    it('should return correct count after adding entries', async () => {
      await redisMock.zadd('feed:u1', 100, 'postA');
      await redisMock.zadd('feed:u1', 200, 'postB');
      expect(await service.getFeedSize('u1')).toBe(2);
    });
  });

  // ── postExistsInFeed ────────────────────────────────────────────────────────

  describe('postExistsInFeed', () => {
    it('should return true when post is in feed', async () => {
      await redisMock.zadd('feed:u1', 100, 'post1');
      expect(await service.postExistsInFeed('u1', 'post1')).toBe(true);
    });

    it('should return false when post is not in feed', async () => {
      expect(await service.postExistsInFeed('u1', 'nonexistent')).toBe(false);
    });
  });

  // ── updatePostScore ─────────────────────────────────────────────────────────

  describe('updatePostScore', () => {
    it('should update score if post exists in feed', async () => {
      await redisMock.zadd('feed:u1', 100, 'post1');

      await service.updatePostScore('u1', 'post1', 999);

      expect(await redisMock.zscore('feed:u1', 'post1')).toBe('999');
    });

    it('should not add post if it does not exist in feed', async () => {
      await service.updatePostScore('u1', 'ghost-post', 999);

      expect(await redisMock.zscore('feed:u1', 'ghost-post')).toBeNull();
    });
  });

  // ── removeFeedEntriesForAuthor ──────────────────────────────────────────────

  describe('removeFeedEntriesForAuthor', () => {
    it('should remove all specified postIds from a user feed', async () => {
      await redisMock.zadd('feed:u1', 100, 'post1');
      await redisMock.zadd('feed:u1', 200, 'post2');
      await redisMock.zadd('feed:u1', 300, 'post3');

      await service.removeFeedEntriesForAuthor('u1', 'authorX', ['post1', 'post2']);

      expect(await redisMock.zscore('feed:u1', 'post1')).toBeNull();
      expect(await redisMock.zscore('feed:u1', 'post2')).toBeNull();
      expect(await redisMock.zscore('feed:u1', 'post3')).not.toBeNull();
    });

    it('should be a no-op when postIds is empty', async () => {
      await redisMock.zadd('feed:u1', 100, 'post1');
      await service.removeFeedEntriesForAuthor('u1', 'authorX', []);
      expect(await redisMock.zcard('feed:u1')).toBe(1);
    });
  });

  // ── getRawFeed ──────────────────────────────────────────────────────────────

  describe('getRawFeed', () => {
    it('should return all feed entries in descending score order', async () => {
      await redisMock.zadd('feed:u1', 100, 'postA');
      await redisMock.zadd('feed:u1', 300, 'postC');
      await redisMock.zadd('feed:u1', 200, 'postB');

      const entries = await service.getRawFeed('u1');

      expect(entries[0].postId).toBe('postC');
      expect(entries[1].postId).toBe('postB');
      expect(entries[2].postId).toBe('postA');
    });

    it('should return empty array for non-existent feed', async () => {
      const entries = await service.getRawFeed('nobody');
      expect(entries).toHaveLength(0);
    });
  });
});
