/**
 * Unit Tests — CommentService
 */

import { CommentService } from '../../../src/services/comment.service';
import { CommentModel } from '../../../src/models/comment.model';
import { LikeModel } from '../../../src/models/like.model';
import { InteractionProducer } from '../../../src/kafka/producers/interaction.producer';
import { CounterService } from '../../../src/services/counter.service';
import { ValidationError, NotFoundError, ForbiddenError } from '../../../src/types';
import { createMockComment, TEST_USER_ID, TEST_POST_ID, TEST_COMMENT_ID } from '../../fixtures';

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/metrics');

describe('CommentService', () => {
  let commentService: CommentService;
  let commentModel: jest.Mocked<CommentModel>;
  let likeModel: jest.Mocked<LikeModel>;
  let counterService: jest.Mocked<CounterService>;
  let producer: jest.Mocked<InteractionProducer>;

  beforeEach(() => {
    commentModel = {
      findById: jest.fn(),
      create: jest.fn(),
      findByPost: jest.fn(),
      findReplies: jest.fn(),
      countByPost: jest.fn(),
      countReplies: jest.fn(),
      softDelete: jest.fn(),
      softDeleteByPost: jest.fn(),
      softDeleteByUser: jest.fn(),
      incrementLikeCount: jest.fn(),
    } as unknown as jest.Mocked<CommentModel>;

    likeModel = {} as unknown as jest.Mocked<LikeModel>;

    counterService = {
      incrementComments: jest.fn().mockResolvedValue(1),
      decrementComments: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<CounterService>;

    producer = {
      publishCommentCreated: jest.fn().mockResolvedValue(undefined),
      publishCommentDeleted: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<InteractionProducer>;

    commentService = new CommentService(commentModel, likeModel, counterService, producer);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createComment ────────────────────────────────────────────────────────────

  describe('createComment', () => {
    it('should create a root comment (depth=0) and return it', async () => {
      const mockComment = createMockComment({ post_id: TEST_POST_ID, user_id: TEST_USER_ID, depth: 0 });
      commentModel.create.mockResolvedValue(mockComment);

      const result = await commentService.createComment({
        post_id: TEST_POST_ID,
        user_id: TEST_USER_ID,
        content: 'Hello world',
      });

      expect(commentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ post_id: TEST_POST_ID, content: 'Hello world' }),
        0 // depth
      );
      expect(counterService.incrementComments).toHaveBeenCalledWith(TEST_POST_ID);
      expect(producer.publishCommentCreated).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'comment_created', userId: TEST_USER_ID })
      );
      expect(result).toEqual(mockComment);
    });

    it('should create a nested reply with depth = parent.depth + 1', async () => {
      const parentComment = createMockComment({ id: TEST_COMMENT_ID, depth: 0, post_id: TEST_POST_ID });
      commentModel.findById.mockResolvedValue(parentComment);

      const replyComment = createMockComment({ depth: 1, parent_id: TEST_COMMENT_ID });
      commentModel.create.mockResolvedValue(replyComment);

      await commentService.createComment({
        post_id: TEST_POST_ID,
        user_id: TEST_USER_ID,
        content: 'This is a reply',
        parent_id: TEST_COMMENT_ID,
      });

      expect(commentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ parent_id: TEST_COMMENT_ID }),
        1 // depth = parent.depth + 1
      );
    });

    it('should throw ValidationError for empty content', async () => {
      await expect(commentService.createComment({
        post_id: TEST_POST_ID,
        user_id: TEST_USER_ID,
        content: '',
      })).rejects.toThrow(ValidationError);

      expect(commentModel.create).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for content exceeding 1000 characters', async () => {
      await expect(commentService.createComment({
        post_id: TEST_POST_ID,
        user_id: TEST_USER_ID,
        content: 'a'.repeat(1001),
      })).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError if parent comment does not exist', async () => {
      commentModel.findById.mockResolvedValue(null);

      await expect(commentService.createComment({
        post_id: TEST_POST_ID,
        user_id: TEST_USER_ID,
        content: 'Reply to ghost',
        parent_id: TEST_COMMENT_ID,
      })).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if nesting depth exceeds maximum (3)', async () => {
      const deepParent = createMockComment({ id: TEST_COMMENT_ID, depth: 3, post_id: TEST_POST_ID });
      commentModel.findById.mockResolvedValue(deepParent);

      await expect(commentService.createComment({
        post_id: TEST_POST_ID,
        user_id: TEST_USER_ID,
        content: 'Too deep',
        parent_id: TEST_COMMENT_ID,
      })).rejects.toThrow(ValidationError);
    });

    it('should publish comment_created Kafka event with correct payload', async () => {
      const mockComment = createMockComment({ post_id: TEST_POST_ID, user_id: TEST_USER_ID });
      commentModel.create.mockResolvedValue(mockComment);

      await commentService.createComment({
        post_id: TEST_POST_ID,
        user_id: TEST_USER_ID,
        content: 'Test content',
      });

      expect(producer.publishCommentCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'comment_created',
          entityId: mockComment.id,
          userId: TEST_USER_ID,
          payload: expect.objectContaining({
            postId: TEST_POST_ID,
            parentId: null,
          }),
        })
      );
    });
  });

  // ── getCommentsByPost ─────────────────────────────────────────────────────────

  describe('getCommentsByPost', () => {
    it('should return paginated root comments with hasMore=false when fewer than limit', async () => {
      const comments = [
        { ...createMockComment({ post_id: TEST_POST_ID }), replies_count: 0 },
        { ...createMockComment({ post_id: TEST_POST_ID }), replies_count: 2 },
      ];
      commentModel.findByPost.mockResolvedValue(comments as any);

      const result = await commentService.getCommentsByPost(TEST_POST_ID, 20);

      expect(result.hasMore).toBe(false);
      expect(result.comments).toHaveLength(2);
      expect(result.cursor).toBeUndefined();
    });

    it('should return hasMore=true and cursor when results exceed limit', async () => {
      // Return limit+1 comments to simulate there are more
      const comments = Array.from({ length: 21 }, (_, i) => ({
        ...createMockComment({ post_id: TEST_POST_ID, created_at: new Date(2024, 0, i + 1) }),
        replies_count: 0,
      }));
      commentModel.findByPost.mockResolvedValue(comments as any);

      const result = await commentService.getCommentsByPost(TEST_POST_ID, 20);

      expect(result.hasMore).toBe(true);
      expect(result.comments).toHaveLength(20);
      expect(result.cursor).toBeDefined();
    });

    it('should pass cursor to model for pagination', async () => {
      commentModel.findByPost.mockResolvedValue([]);
      const cursor = new Date().toISOString();

      await commentService.getCommentsByPost(TEST_POST_ID, 10, cursor);

      expect(commentModel.findByPost).toHaveBeenCalledWith(TEST_POST_ID, 11, cursor);
    });
  });

  // ── deleteComment ─────────────────────────────────────────────────────────────

  describe('deleteComment', () => {
    it('should soft delete a comment when owner requests it', async () => {
      const mockComment = createMockComment({ id: TEST_COMMENT_ID, user_id: TEST_USER_ID, post_id: TEST_POST_ID });
      commentModel.findById.mockResolvedValue(mockComment);
      commentModel.softDelete.mockResolvedValue(true);

      await commentService.deleteComment(TEST_COMMENT_ID, TEST_USER_ID);

      expect(commentModel.softDelete).toHaveBeenCalledWith(TEST_COMMENT_ID);
      expect(counterService.decrementComments).toHaveBeenCalledWith(TEST_POST_ID);
      expect(producer.publishCommentDeleted).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'comment_deleted', entityId: TEST_COMMENT_ID })
      );
    });

    it('should throw ForbiddenError when non-owner tries to delete', async () => {
      const anotherUser = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      const mockComment = createMockComment({ id: TEST_COMMENT_ID, user_id: anotherUser });
      commentModel.findById.mockResolvedValue(mockComment);

      await expect(commentService.deleteComment(TEST_COMMENT_ID, TEST_USER_ID))
        .rejects.toThrow(ForbiddenError);

      expect(commentModel.softDelete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when comment does not exist', async () => {
      commentModel.findById.mockResolvedValue(null);

      await expect(commentService.deleteComment(TEST_COMMENT_ID, TEST_USER_ID))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when comment is already deleted', async () => {
      const mockComment = createMockComment({ id: TEST_COMMENT_ID, user_id: TEST_USER_ID });
      commentModel.findById.mockResolvedValue(mockComment);
      commentModel.softDelete.mockResolvedValue(false);

      await expect(commentService.deleteComment(TEST_COMMENT_ID, TEST_USER_ID))
        .rejects.toThrow(NotFoundError);
    });
  });

  // ── getReplies ────────────────────────────────────────────────────────────────

  describe('getReplies', () => {
    it('should return replies for a valid comment', async () => {
      const parentComment = createMockComment({ id: TEST_COMMENT_ID });
      const replies = [
        { ...createMockComment({ parent_id: TEST_COMMENT_ID, depth: 1 }), replies_count: 0 },
      ];
      commentModel.findById.mockResolvedValue(parentComment);
      commentModel.findReplies.mockResolvedValue(replies as any);

      const result = await commentService.getReplies(TEST_COMMENT_ID);

      expect(commentModel.findReplies).toHaveBeenCalledWith(TEST_COMMENT_ID, 20);
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundError if parent comment does not exist', async () => {
      commentModel.findById.mockResolvedValue(null);

      await expect(commentService.getReplies(TEST_COMMENT_ID)).rejects.toThrow(NotFoundError);
    });
  });
});
