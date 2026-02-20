/**
 * Unit Tests — PostService
 */

import { PostService } from '../../../src/services/post.service';
import { PostModel } from '../../../src/models/post.model';
import { EditHistoryModel } from '../../../src/models/editHistory.model';
import { HashtagService } from '../../../src/services/hashtag.service';
import { CacheService } from '../../../src/services/cache.service';
import { PostProducer } from '../../../src/kafka/producers/post.producer';
import { createMockPost } from '../../fixtures';
import { PostNotFoundError, PostForbiddenError, ValidationError } from '../../../src/types';

jest.mock('../../../src/models/post.model');
jest.mock('../../../src/models/editHistory.model');
jest.mock('../../../src/services/hashtag.service');
jest.mock('../../../src/services/cache.service');
jest.mock('../../../src/kafka/producers/post.producer');

const MockPostModel = PostModel as jest.MockedClass<typeof PostModel>;
const MockEditHistoryModel = EditHistoryModel as jest.MockedClass<typeof EditHistoryModel>;
const MockHashtagService = HashtagService as jest.MockedClass<typeof HashtagService>;
const MockCacheService = CacheService as jest.MockedClass<typeof CacheService>;
const MockPostProducer = PostProducer as jest.MockedClass<typeof PostProducer>;

describe('PostService', () => {
  let postService: PostService;
  let postModel: jest.Mocked<PostModel>;
  let editHistoryModel: jest.Mocked<EditHistoryModel>;
  let hashtagService: jest.Mocked<HashtagService>;
  let cacheService: jest.Mocked<CacheService>;
  let postProducer: jest.Mocked<PostProducer>;

  const userId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    postModel = new MockPostModel() as jest.Mocked<PostModel>;
    editHistoryModel = new MockEditHistoryModel() as jest.Mocked<EditHistoryModel>;
    hashtagService = new MockHashtagService({} as never) as jest.Mocked<HashtagService>;
    cacheService = new MockCacheService() as jest.Mocked<CacheService>;
    postProducer = new MockPostProducer() as jest.Mocked<PostProducer>;

    postService = new PostService(postModel, editHistoryModel, hashtagService, cacheService, postProducer);

    cacheService.getPost.mockResolvedValue(null);
    cacheService.setPost.mockResolvedValue(undefined);
    cacheService.deletePost.mockResolvedValue(undefined);
    hashtagService.processForPost.mockResolvedValue(['hashtag']);
    hashtagService.reprocessForPost.mockResolvedValue([]);
    postProducer.publishPostCreated.mockResolvedValue(undefined);
    postProducer.publishPostUpdated.mockResolvedValue(undefined);
    postProducer.publishPostDeleted.mockResolvedValue(undefined);
    postProducer.publishPostScheduled.mockResolvedValue(undefined);
  });

  describe('createPost', () => {
    it('should create post with PUBLIC visibility by default', async () => {
      const mockPost = createMockPost({ user_id: userId, visibility: 'PUBLIC' });
      postModel.create.mockResolvedValue(mockPost);

      const result = await postService.createPost(userId, { content: 'Hello #world' });

      expect(postModel.create).toHaveBeenCalledWith(userId, expect.objectContaining({ moderation_status: 'PENDING' }));
      expect(result.visibility).toBe('PUBLIC');
    });

    it('should extract hashtags from content', async () => {
      const mockPost = createMockPost({ user_id: userId });
      postModel.create.mockResolvedValue(mockPost);

      await postService.createPost(userId, { content: 'Post with #tag1' });

      expect(hashtagService.processForPost).toHaveBeenCalledWith(mockPost.id, mockPost.content);
    });

    it('should set moderation_status to PENDING', async () => {
      const mockPost = createMockPost({ user_id: userId, moderation_status: 'PENDING' });
      postModel.create.mockResolvedValue(mockPost);

      const result = await postService.createPost(userId, { content: 'Valid content' });

      expect(result.moderation_status).toBe('PENDING');
    });

    it('should publish post_created Kafka event', async () => {
      const mockPost = createMockPost({ user_id: userId });
      postModel.create.mockResolvedValue(mockPost);

      await postService.createPost(userId, { content: 'Content' });

      expect(postProducer.publishPostCreated).toHaveBeenCalled();
    });

    it('should throw ValidationError for empty content', async () => {
      await expect(postService.createPost(userId, { content: '' })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for content > 2000 chars', async () => {
      await expect(postService.createPost(userId, { content: 'A'.repeat(2001) })).rejects.toThrow(ValidationError);
    });

    it('should create scheduled post when scheduled_at is in the future', async () => {
      const futureDate = new Date(Date.now() + 3600_000).toISOString();
      const mockPost = createMockPost({ user_id: userId, is_scheduled: true });
      postModel.create.mockResolvedValue(mockPost);

      const result = await postService.createPost(userId, { content: 'Scheduled', scheduled_at: futureDate });

      expect(result.is_scheduled).toBe(true);
      expect(postProducer.publishPostScheduled).toHaveBeenCalled();
      expect(postProducer.publishPostCreated).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for scheduled_at in the past', async () => {
      const pastDate = new Date(Date.now() - 3600_000).toISOString();
      await expect(postService.createPost(userId, { content: 'Past', scheduled_at: pastDate })).rejects.toThrow(ValidationError);
    });
  });

  describe('getPost', () => {
    it('should return post from L2 cache if available', async () => {
      const mockPost = createMockPost({ visibility: 'PUBLIC' });
      cacheService.getPost.mockResolvedValue(mockPost);

      const result = await postService.getPost(mockPost.id);

      expect(result).toEqual(mockPost);
      expect(postModel.findById).not.toHaveBeenCalled();
    });

    it('should query DB on cache miss and populate cache', async () => {
      const mockPost = createMockPost({ visibility: 'PUBLIC' });
      cacheService.getPost.mockResolvedValue(null);
      postModel.findById.mockResolvedValue(mockPost);

      const result = await postService.getPost(mockPost.id);

      expect(postModel.findById).toHaveBeenCalledWith(mockPost.id);
      expect(cacheService.setPost).toHaveBeenCalledWith(mockPost);
      expect(result).toEqual(mockPost);
    });

    it('should throw PostNotFoundError for non-existent post', async () => {
      postModel.findById.mockResolvedValue(null);
      await expect(postService.getPost('non-existent')).rejects.toThrow(PostNotFoundError);
    });

    it('should throw PostForbiddenError for PRIVATE post of another user', async () => {
      const post = createMockPost({ visibility: 'PRIVATE', user_id: 'owner-id' });
      postModel.findById.mockResolvedValue(post);
      await expect(postService.getPost(post.id, 'other-user')).rejects.toThrow(PostForbiddenError);
    });

    it('should return PRIVATE post to its owner', async () => {
      const post = createMockPost({ visibility: 'PRIVATE', user_id: userId });
      postModel.findById.mockResolvedValue(post);
      const result = await postService.getPost(post.id, userId);
      expect(result).toEqual(post);
    });
  });

  describe('updatePost', () => {
    it('should update content and create entry in edit_history', async () => {
      const existing = createMockPost({ user_id: userId, content: 'Old content' });
      const updated = { ...existing, content: 'New content' };
      postModel.findById.mockResolvedValue(existing);
      postModel.update.mockResolvedValue(updated);
      editHistoryModel.create.mockResolvedValue({} as never);

      await postService.updatePost(existing.id, userId, { content: 'New content' });

      expect(editHistoryModel.create).toHaveBeenCalledWith(existing.id, existing.content);
    });

    it('should throw ForbiddenError if not the author', async () => {
      const post = createMockPost({ user_id: 'another-user' });
      postModel.findById.mockResolvedValue(post);
      await expect(postService.updatePost(post.id, userId, { content: 'X' })).rejects.toThrow(PostForbiddenError);
    });

    it('should publish post_updated Kafka event', async () => {
      const post = createMockPost({ user_id: userId });
      const updated = { ...post, content: 'Updated' };
      postModel.findById.mockResolvedValue(post);
      postModel.update.mockResolvedValue(updated);
      editHistoryModel.create.mockResolvedValue({} as never);

      await postService.updatePost(post.id, userId, { content: 'Updated' });

      expect(postProducer.publishPostUpdated).toHaveBeenCalledWith(updated);
    });

    it('should re-extract hashtags on content update', async () => {
      const post = createMockPost({ user_id: userId, content: 'Old #tag' });
      const updated = { ...post, content: 'New #newtag' };
      postModel.findById.mockResolvedValue(post);
      postModel.update.mockResolvedValue(updated);
      editHistoryModel.create.mockResolvedValue({} as never);

      await postService.updatePost(post.id, userId, { content: 'New #newtag' });

      expect(hashtagService.reprocessForPost).toHaveBeenCalledWith(post.id, 'New #newtag');
    });
  });

  describe('deletePost', () => {
    it('should soft delete with deleted_at timestamp', async () => {
      const post = createMockPost({ user_id: userId });
      postModel.findById.mockResolvedValue(post);
      postModel.softDelete.mockResolvedValue(undefined);

      await postService.deletePost(post.id, userId);

      expect(postModel.softDelete).toHaveBeenCalledWith(post.id);
    });

    it('should publish post_deleted Kafka event', async () => {
      const post = createMockPost({ user_id: userId });
      postModel.findById.mockResolvedValue(post);
      postModel.softDelete.mockResolvedValue(undefined);

      await postService.deletePost(post.id, userId);

      expect(postProducer.publishPostDeleted).toHaveBeenCalledWith(post.id, userId);
    });

    it('should throw ForbiddenError if not the author', async () => {
      const post = createMockPost({ user_id: 'other' });
      postModel.findById.mockResolvedValue(post);
      await expect(postService.deletePost(post.id, userId)).rejects.toThrow(PostForbiddenError);
    });
  });

  describe('listByUser', () => {
    it('should paginate correctly — hasMore true when more items exist', async () => {
      const posts = Array.from({ length: 21 }, () => createMockPost({ user_id: userId }));
      postModel.findByUserId.mockResolvedValue(posts);

      const result = await postService.listByUser(userId, userId, { limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.cursor).toBeDefined();
    });

    it('should have hasMore false when all items fit', async () => {
      const posts = Array.from({ length: 5 }, () => createMockPost({ user_id: userId }));
      postModel.findByUserId.mockResolvedValue(posts);

      const result = await postService.listByUser(userId, userId, { limit: 20 });

      expect(result.hasMore).toBe(false);
      expect(result.cursor).toBeUndefined();
    });
  });
});
