/**
 * Unit Tests — SchedulerService
 */

import { SchedulerService } from '../../../src/services/scheduler.service';
import { PostModel } from '../../../src/models/post.model';
import { PostProducer } from '../../../src/kafka/producers/post.producer';
import { HashtagService } from '../../../src/services/hashtag.service';
import { CacheService } from '../../../src/services/cache.service';
import { createMockPost } from '../../fixtures';

jest.mock('../../../src/models/post.model');
jest.mock('../../../src/kafka/producers/post.producer');
jest.mock('../../../src/services/hashtag.service');
jest.mock('../../../src/services/cache.service');
jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../src/utils/metrics', () => ({
  postMetrics: { scheduledPostsPublished: { inc: jest.fn() } },
}));

const MockPostModel = PostModel as jest.MockedClass<typeof PostModel>;
const MockPostProducer = PostProducer as jest.MockedClass<typeof PostProducer>;
const MockHashtagService = HashtagService as jest.MockedClass<typeof HashtagService>;
const MockCacheService = CacheService as jest.MockedClass<typeof CacheService>;

describe('SchedulerService', () => {
  let schedulerService: SchedulerService;
  let postModel: jest.Mocked<PostModel>;
  let postProducer: jest.Mocked<PostProducer>;
  let hashtagService: jest.Mocked<HashtagService>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    jest.clearAllMocks();
    postModel = new MockPostModel() as jest.Mocked<PostModel>;
    postProducer = new MockPostProducer() as jest.Mocked<PostProducer>;
    hashtagService = new MockHashtagService({} as never) as jest.Mocked<HashtagService>;
    cacheService = new MockCacheService() as jest.Mocked<CacheService>;

    schedulerService = new SchedulerService(postModel, postProducer, hashtagService, cacheService);

    postModel.findDueScheduledPosts.mockResolvedValue([]);
    postModel.publishScheduled.mockResolvedValue(undefined);
    hashtagService.processForPost.mockResolvedValue(['tag']);
    postProducer.publishPostCreated.mockResolvedValue(undefined);
    cacheService.deletePost.mockResolvedValue(undefined);
  });

  afterEach(() => {
    schedulerService.stop();
  });

  describe('publishDuePosts', () => {
    it('should do nothing if no scheduled posts are due', async () => {
      postModel.findDueScheduledPosts.mockResolvedValue([]);

      await schedulerService.publishDuePosts();

      expect(postModel.publishScheduled).not.toHaveBeenCalled();
      expect(postProducer.publishPostCreated).not.toHaveBeenCalled();
    });

    it('should publish post when scheduled_at <= NOW()', async () => {
      const duePost = createMockPost({
        is_scheduled: true,
        scheduled_at: new Date(Date.now() - 1000), // in the past
        published_at: null,
      });
      postModel.findDueScheduledPosts.mockResolvedValue([duePost]);

      await schedulerService.publishDuePosts();

      expect(postModel.publishScheduled).toHaveBeenCalledWith(duePost.id);
      expect(postProducer.publishPostCreated).toHaveBeenCalled();
    });

    it('should mark post as published after successful publish', async () => {
      const duePost = createMockPost({
        is_scheduled: true,
        scheduled_at: new Date(Date.now() - 5000),
      });
      postModel.findDueScheduledPosts.mockResolvedValue([duePost]);

      await schedulerService.publishDuePosts();

      expect(postModel.publishScheduled).toHaveBeenCalledWith(duePost.id);
    });

    it('should process hashtags for each published post', async () => {
      const duePost = createMockPost({ is_scheduled: true, content: 'Post with #tag' });
      postModel.findDueScheduledPosts.mockResolvedValue([duePost]);

      await schedulerService.publishDuePosts();

      expect(hashtagService.processForPost).toHaveBeenCalledWith(duePost.id, duePost.content);
    });

    it('should invalidate cache after publishing', async () => {
      const duePost = createMockPost({ is_scheduled: true });
      postModel.findDueScheduledPosts.mockResolvedValue([duePost]);

      await schedulerService.publishDuePosts();

      expect(cacheService.deletePost).toHaveBeenCalledWith(duePost.id);
    });

    it('should handle Kafka errors and continue with other posts', async () => {
      const post1 = createMockPost({ id: 'post-1', is_scheduled: true });
      const post2 = createMockPost({ id: 'post-2', is_scheduled: true });
      postModel.findDueScheduledPosts.mockResolvedValue([post1, post2]);
      postModel.publishScheduled
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      postProducer.publishPostCreated
        .mockRejectedValueOnce(new Error('Kafka error'))
        .mockResolvedValueOnce(undefined);

      // Should not throw even if first post fails
      await expect(schedulerService.publishDuePosts()).resolves.not.toThrow();

      // Both posts should have been attempted
      expect(postModel.publishScheduled).toHaveBeenCalledTimes(2);
    });

    it('should publish multiple due posts', async () => {
      const posts = [
        createMockPost({ is_scheduled: true }),
        createMockPost({ is_scheduled: true }),
        createMockPost({ is_scheduled: true }),
      ];
      postModel.findDueScheduledPosts.mockResolvedValue(posts);

      await schedulerService.publishDuePosts();

      expect(postModel.publishScheduled).toHaveBeenCalledTimes(3);
      expect(postProducer.publishPostCreated).toHaveBeenCalledTimes(3);
    });
  });

  describe('start / stop', () => {
    it('should start the scheduler without throwing', () => {
      expect(() => schedulerService.start()).not.toThrow();
    });

    it('should stop the scheduler without throwing', () => {
      schedulerService.start();
      expect(() => schedulerService.stop()).not.toThrow();
    });

    it('should handle stop when never started', () => {
      expect(() => schedulerService.stop()).not.toThrow();
    });
  });
});
