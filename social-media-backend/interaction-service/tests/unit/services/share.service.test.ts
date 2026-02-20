/**
 * Unit Tests — ShareService
 */

import { ShareService } from '../../../src/services/share.service';
import { ShareModel } from '../../../src/models/share.model';
import { InteractionProducer } from '../../../src/kafka/producers/interaction.producer';
import { ConflictError } from '../../../src/types';
import { createMockShare, TEST_USER_ID, TEST_POST_ID } from '../../fixtures';

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/metrics');

describe('ShareService', () => {
  let shareService: ShareService;
  let shareModel: jest.Mocked<ShareModel>;
  let producer: jest.Mocked<InteractionProducer>;

  beforeEach(() => {
    shareModel = {
      findByUserAndPost: jest.fn(),
      create: jest.fn(),
      countByPost: jest.fn(),
      deleteByPost: jest.fn(),
      deleteByUser: jest.fn(),
      findByPost: jest.fn(),
    } as unknown as jest.Mocked<ShareModel>;

    producer = {
      publishShareCreated: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<InteractionProducer>;

    shareService = new ShareService(shareModel, producer);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createShare ───────────────────────────────────────────────────────────────

  describe('createShare', () => {
    it('should create a share and publish Kafka event', async () => {
      shareModel.findByUserAndPost.mockResolvedValue(null);
      const mockShare = createMockShare({ user_id: TEST_USER_ID, post_id: TEST_POST_ID });
      shareModel.create.mockResolvedValue(mockShare);
      shareModel.countByPost.mockResolvedValue(5);

      const result = await shareService.createShare({
        user_id: TEST_USER_ID,
        post_id: TEST_POST_ID,
        comment: 'Check this out!',
      });

      expect(shareModel.create).toHaveBeenCalledWith({
        user_id: TEST_USER_ID,
        post_id: TEST_POST_ID,
        comment: 'Check this out!',
      });
      expect(shareModel.countByPost).toHaveBeenCalledWith(TEST_POST_ID);
      expect(producer.publishShareCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'share_created',
          entityId: TEST_POST_ID,
          userId: TEST_USER_ID,
          payload: expect.objectContaining({ shareId: mockShare.id }),
        })
      );
      expect(result.share).toEqual(mockShare);
      expect(result.count).toBe(5);
    });

    it('should throw ConflictError if user already shared the post', async () => {
      shareModel.findByUserAndPost.mockResolvedValue(createMockShare());

      await expect(shareService.createShare({ user_id: TEST_USER_ID, post_id: TEST_POST_ID }))
        .rejects.toThrow(ConflictError);

      expect(shareModel.create).not.toHaveBeenCalled();
      expect(producer.publishShareCreated).not.toHaveBeenCalled();
    });

    it('should create a share without optional comment', async () => {
      shareModel.findByUserAndPost.mockResolvedValue(null);
      const mockShare = createMockShare({ user_id: TEST_USER_ID, post_id: TEST_POST_ID, comment: null });
      shareModel.create.mockResolvedValue(mockShare);
      shareModel.countByPost.mockResolvedValue(1);

      const result = await shareService.createShare({ user_id: TEST_USER_ID, post_id: TEST_POST_ID });

      expect(shareModel.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ comment: expect.anything() })
      );
      expect(result.share.comment).toBeNull();
    });

    it('should publish share_created event with correct payload', async () => {
      shareModel.findByUserAndPost.mockResolvedValue(null);
      const mockShare = createMockShare({ id: 'share-id-111' });
      shareModel.create.mockResolvedValue(mockShare);
      shareModel.countByPost.mockResolvedValue(2);

      await shareService.createShare({ user_id: TEST_USER_ID, post_id: TEST_POST_ID });

      const eventArg = producer.publishShareCreated.mock.calls[0][0];
      expect(eventArg.type).toBe('share_created');
      expect(eventArg.payload.shareId).toBe('share-id-111');
    });
  });

  // ── getShareCount ─────────────────────────────────────────────────────────────

  describe('getShareCount', () => {
    it('should return the share count for a post', async () => {
      shareModel.countByPost.mockResolvedValue(42);

      const count = await shareService.getShareCount(TEST_POST_ID);

      expect(count).toBe(42);
      expect(shareModel.countByPost).toHaveBeenCalledWith(TEST_POST_ID);
    });
  });

  // ── getSharesByPost ───────────────────────────────────────────────────────────

  describe('getSharesByPost', () => {
    it('should return paginated shares with hasMore=false', async () => {
      const shares = [createMockShare({ post_id: TEST_POST_ID }), createMockShare({ post_id: TEST_POST_ID })];
      shareModel.findByPost.mockResolvedValue(shares);

      const result = await shareService.getSharesByPost(TEST_POST_ID, 20);

      expect(result.hasMore).toBe(false);
      expect(result.shares).toHaveLength(2);
      expect(result.cursor).toBeUndefined();
    });

    it('should set hasMore=true and provide cursor when results exceed limit', async () => {
      const shares = Array.from({ length: 21 }, (_, i) =>
        createMockShare({ post_id: TEST_POST_ID, created_at: new Date(2024, 0, i + 1) })
      );
      shareModel.findByPost.mockResolvedValue(shares);

      const result = await shareService.getSharesByPost(TEST_POST_ID, 20);

      expect(result.hasMore).toBe(true);
      expect(result.shares).toHaveLength(20);
      expect(result.cursor).toBeDefined();
    });
  });
});
