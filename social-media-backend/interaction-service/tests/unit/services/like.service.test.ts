/**
 * Unit Tests — LikeService
 */

import { LikeService } from '../../../src/services/like.service';
import { LikeModel } from '../../../src/models/like.model';
import { CommentModel } from '../../../src/models/comment.model';
import { InteractionProducer } from '../../../src/kafka/producers/interaction.producer';
import { CounterService } from '../../../src/services/counter.service';
import { ConflictError, NotFoundError } from '../../../src/types';
import { createMockLike, createMockComment, TEST_USER_ID, TEST_POST_ID, TEST_COMMENT_ID } from '../../fixtures';

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/metrics');

describe('LikeService', () => {
  let likeService: LikeService;
  let likeModel: jest.Mocked<LikeModel>;
  let commentModel: jest.Mocked<CommentModel>;
  let counterService: jest.Mocked<CounterService>;
  let producer: jest.Mocked<InteractionProducer>;

  beforeEach(() => {
    likeModel = {
      findByUserAndTarget: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      countByTarget: jest.fn(),
      getUserLikedPosts: jest.fn(),
      deleteByTarget: jest.fn(),
      deleteByUser: jest.fn(),
      getByTarget: jest.fn(),
    } as unknown as jest.Mocked<LikeModel>;

    commentModel = {
      incrementLikeCount: jest.fn(),
    } as unknown as jest.Mocked<CommentModel>;

    counterService = {
      incrementLikes: jest.fn().mockResolvedValue(5),
      decrementLikes: jest.fn().mockResolvedValue(4),
      getLikesCount: jest.fn().mockResolvedValue(null),
      addUserLike: jest.fn().mockResolvedValue(undefined),
      removeUserLike: jest.fn().mockResolvedValue(undefined),
      hasUserLiked: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<CounterService>;

    producer = {
      publishLikeCreated: jest.fn().mockResolvedValue(undefined),
      publishLikeDeleted: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<InteractionProducer>;

    likeService = new LikeService(likeModel, commentModel, counterService, producer);
  });

  afterEach(() => jest.clearAllMocks());

  // ── addLike ──────────────────────────────────────────────────────────────────

  describe('addLike', () => {
    it('should create a like for a POST and return updated count', async () => {
      likeModel.findByUserAndTarget.mockResolvedValue(null);
      const mockLike = createMockLike({ user_id: TEST_USER_ID, target_id: TEST_POST_ID, target_type: 'POST' });
      likeModel.create.mockResolvedValue(mockLike);
      counterService.incrementLikes.mockResolvedValue(10);

      const result = await likeService.addLike(TEST_USER_ID, TEST_POST_ID, 'POST');

      expect(likeModel.findByUserAndTarget).toHaveBeenCalledWith(TEST_USER_ID, TEST_POST_ID, 'POST');
      expect(likeModel.create).toHaveBeenCalledWith({
        user_id: TEST_USER_ID,
        target_id: TEST_POST_ID,
        target_type: 'POST',
      });
      expect(counterService.incrementLikes).toHaveBeenCalledWith(TEST_POST_ID, 'POST');
      expect(counterService.addUserLike).toHaveBeenCalledWith(TEST_USER_ID, TEST_POST_ID);
      expect(producer.publishLikeCreated).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'like_created', entityId: TEST_POST_ID, userId: TEST_USER_ID })
      );
      expect(result).toEqual({ like: mockLike, count: 10 });
    });

    it('should create a like for a COMMENT and increment comment like_count', async () => {
      likeModel.findByUserAndTarget.mockResolvedValue(null);
      const mockLike = createMockLike({ target_type: 'COMMENT', target_id: TEST_COMMENT_ID });
      likeModel.create.mockResolvedValue(mockLike);
      counterService.incrementLikes.mockResolvedValue(3);

      await likeService.addLike(TEST_USER_ID, TEST_COMMENT_ID, 'COMMENT');

      expect(commentModel.incrementLikeCount).toHaveBeenCalledWith(TEST_COMMENT_ID, 1);
      expect(counterService.addUserLike).not.toHaveBeenCalled(); // only for POSTs
    });

    it('should throw ConflictError if already liked', async () => {
      likeModel.findByUserAndTarget.mockResolvedValue(createMockLike());

      await expect(likeService.addLike(TEST_USER_ID, TEST_POST_ID, 'POST'))
        .rejects.toThrow(ConflictError);

      expect(likeModel.create).not.toHaveBeenCalled();
    });

    it('should publish like_created Kafka event', async () => {
      likeModel.findByUserAndTarget.mockResolvedValue(null);
      likeModel.create.mockResolvedValue(createMockLike());

      await likeService.addLike(TEST_USER_ID, TEST_POST_ID, 'POST');

      expect(producer.publishLikeCreated).toHaveBeenCalledTimes(1);
      const eventArg = producer.publishLikeCreated.mock.calls[0][0];
      expect(eventArg.type).toBe('like_created');
      expect(eventArg.payload.targetType).toBe('POST');
    });
  });

  // ── removeLike ───────────────────────────────────────────────────────────────

  describe('removeLike', () => {
    it('should remove a like and decrement counter', async () => {
      const mockLike = createMockLike({ user_id: TEST_USER_ID, target_id: TEST_POST_ID, target_type: 'POST' });
      likeModel.findByUserAndTarget.mockResolvedValue(mockLike);
      likeModel.delete.mockResolvedValue(true);
      counterService.decrementLikes.mockResolvedValue(4);

      const result = await likeService.removeLike(TEST_USER_ID, TEST_POST_ID, 'POST');

      expect(likeModel.delete).toHaveBeenCalledWith(TEST_USER_ID, TEST_POST_ID, 'POST');
      expect(counterService.decrementLikes).toHaveBeenCalledWith(TEST_POST_ID, 'POST');
      expect(counterService.removeUserLike).toHaveBeenCalledWith(TEST_USER_ID, TEST_POST_ID);
      expect(producer.publishLikeDeleted).toHaveBeenCalledTimes(1);
      expect(result.count).toBe(4);
    });

    it('should remove like from COMMENT and decrement comment like_count', async () => {
      const mockLike = createMockLike({ user_id: TEST_USER_ID, target_id: TEST_COMMENT_ID, target_type: 'COMMENT' });
      likeModel.findByUserAndTarget.mockResolvedValue(mockLike);
      likeModel.delete.mockResolvedValue(true);
      counterService.decrementLikes.mockResolvedValue(0);

      await likeService.removeLike(TEST_USER_ID, TEST_COMMENT_ID, 'COMMENT');

      expect(commentModel.incrementLikeCount).toHaveBeenCalledWith(TEST_COMMENT_ID, -1);
    });

    it('should throw NotFoundError if like does not exist', async () => {
      likeModel.findByUserAndTarget.mockResolvedValue(null);

      await expect(likeService.removeLike(TEST_USER_ID, TEST_POST_ID, 'POST'))
        .rejects.toThrow(NotFoundError);

      expect(likeModel.delete).not.toHaveBeenCalled();
    });
  });

  // ── getLikeCount ─────────────────────────────────────────────────────────────

  describe('getLikeCount', () => {
    it('should return Redis cached value if available', async () => {
      counterService.getLikesCount.mockResolvedValue(42);

      const count = await likeService.getLikeCount(TEST_POST_ID, 'POST');

      expect(count).toBe(42);
      expect(likeModel.countByTarget).not.toHaveBeenCalled();
    });

    it('should fall back to DB if Redis cache miss', async () => {
      counterService.getLikesCount.mockResolvedValue(null);
      likeModel.countByTarget.mockResolvedValue(7);

      const count = await likeService.getLikeCount(TEST_POST_ID, 'POST');

      expect(count).toBe(7);
      expect(likeModel.countByTarget).toHaveBeenCalledWith(TEST_POST_ID, 'POST');
    });
  });

  // ── hasLiked ─────────────────────────────────────────────────────────────────

  describe('hasLiked', () => {
    it('should return true when Redis SET indicates user liked post', async () => {
      counterService.hasUserLiked.mockResolvedValue(true);

      const result = await likeService.hasLiked(TEST_USER_ID, TEST_POST_ID, 'POST');

      expect(result).toBe(true);
      expect(likeModel.findByUserAndTarget).not.toHaveBeenCalled();
    });

    it('should fall back to DB query when Redis cache miss', async () => {
      counterService.hasUserLiked.mockResolvedValue(false);
      likeModel.findByUserAndTarget.mockResolvedValue(createMockLike());

      const result = await likeService.hasLiked(TEST_USER_ID, TEST_POST_ID, 'POST');

      expect(result).toBe(true);
      expect(likeModel.findByUserAndTarget).toHaveBeenCalledWith(TEST_USER_ID, TEST_POST_ID, 'POST');
    });

    it('should return false when like does not exist in DB', async () => {
      counterService.hasUserLiked.mockResolvedValue(false);
      likeModel.findByUserAndTarget.mockResolvedValue(null);

      const result = await likeService.hasLiked(TEST_USER_ID, TEST_POST_ID, 'POST');

      expect(result).toBe(false);
    });

    it('should always check DB for COMMENT likes (no Redis SET for comments)', async () => {
      likeModel.findByUserAndTarget.mockResolvedValue(createMockLike({ target_type: 'COMMENT' }));

      const result = await likeService.hasLiked(TEST_USER_ID, TEST_COMMENT_ID, 'COMMENT');

      // counterService.hasUserLiked should NOT be called for comments
      expect(counterService.hasUserLiked).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
