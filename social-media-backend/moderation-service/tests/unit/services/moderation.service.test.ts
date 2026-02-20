import { ModerationService } from '../../../src/services/moderation.service';
import { mlService } from '../../../src/services/ml.service';
import { moderationCaseModel } from '../../../src/models/moderationCase.model';
import { moderationDecisionModel } from '../../../src/models/moderationDecision.model';
import { moderationProducer } from '../../../src/kafka/producers/moderation.producer';
import { createModerationCaseFixture, createDecisionFixture } from '../../fixtures';

jest.mock('../../../src/services/ml.service');
jest.mock('../../../src/models/moderationCase.model');
jest.mock('../../../src/models/moderationDecision.model');
jest.mock('../../../src/kafka/producers/moderation.producer');
jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/utils/metrics', () => ({
  casesCreatedTotal: { inc: jest.fn() },
  decisionsTotal: { inc: jest.fn() },
  mlAnalysisDuration: { startTimer: jest.fn().mockReturnValue(jest.fn()) },
  appealsTotal: { inc: jest.fn() },
}));

const mlServiceMock = mlService as jest.Mocked<typeof mlService>;
const caseModelMock = moderationCaseModel as jest.Mocked<typeof moderationCaseModel>;
const decisionModelMock = moderationDecisionModel as jest.Mocked<typeof moderationDecisionModel>;
const producerMock = moderationProducer as jest.Mocked<typeof moderationProducer>;

describe('ModerationService', () => {
  let service: ModerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ModerationService();
  });

  describe('analyzeContent', () => {
    it('should call Perspective API and store ml_score', async () => {
      const entityId = 'post-123';
      const content = 'Normal content here';
      const mockCase = createModerationCaseFixture({ entity_id: entityId, ml_score: 0.1 });

      mlServiceMock.analyzeText.mockResolvedValue({ score: 0.1, categories: { toxicity: 0.1 } });
      mlServiceMock.analyzeImage.mockResolvedValue({ safe: true, labels: [], score: 0 });
      caseModelMock.create.mockResolvedValue(mockCase);
      decisionModelMock.create.mockResolvedValue(createDecisionFixture({ decision: 'APPROVED' }));
      producerMock.publishContentApproved.mockResolvedValue(undefined);

      const result = await service.analyzeContent(entityId, 'POST', content, []);

      expect(mlServiceMock.analyzeText).toHaveBeenCalledWith(content);
      expect(caseModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ entity_id: entityId, ml_score: 0.1 }),
      );
      expect(result).toEqual(mockCase);
    });

    it('should auto-flag content when ml_score > 0.8', async () => {
      const entityId = 'toxic-post';
      const mockCase = createModerationCaseFixture({ entity_id: entityId, ml_score: 0.95, status: 'RESOLVED' });

      mlServiceMock.analyzeText.mockResolvedValue({ score: 0.95, categories: { toxicity: 0.95 } });
      mlServiceMock.analyzeImage.mockResolvedValue({ safe: true, labels: [], score: 0 });
      caseModelMock.create.mockResolvedValue(mockCase);
      decisionModelMock.create.mockResolvedValue(createDecisionFixture({ decision: 'REJECTED' }));
      producerMock.publishContentRejected.mockResolvedValue(undefined);

      await service.analyzeContent(entityId, 'POST', 'Toxic content', []);

      expect(decisionModelMock.create).toHaveBeenCalledWith(
        mockCase.id,
        expect.objectContaining({ decision: 'REJECTED' }),
        null,
      );
      expect(producerMock.publishContentRejected).toHaveBeenCalled();
    });

    it('should auto-approve content when ml_score < 0.2', async () => {
      const entityId = 'clean-post';
      const mockCase = createModerationCaseFixture({ entity_id: entityId, ml_score: 0.05, status: 'RESOLVED' });

      mlServiceMock.analyzeText.mockResolvedValue({ score: 0.05, categories: { toxicity: 0.05 } });
      mlServiceMock.analyzeImage.mockResolvedValue({ safe: true, labels: [], score: 0 });
      caseModelMock.create.mockResolvedValue(mockCase);
      decisionModelMock.create.mockResolvedValue(createDecisionFixture({ decision: 'APPROVED' }));
      producerMock.publishContentApproved.mockResolvedValue(undefined);

      await service.analyzeContent(entityId, 'POST', 'Clean content', []);

      expect(decisionModelMock.create).toHaveBeenCalledWith(
        mockCase.id,
        expect.objectContaining({ decision: 'APPROVED' }),
        null,
      );
      expect(producerMock.publishContentApproved).toHaveBeenCalled();
    });

    it('should create moderation_case with PENDING status for borderline scores (0.2-0.8)', async () => {
      const entityId = 'borderline-post';
      const mockCase = createModerationCaseFixture({ entity_id: entityId, ml_score: 0.5, status: 'PENDING' });

      mlServiceMock.analyzeText.mockResolvedValue({ score: 0.5, categories: { toxicity: 0.5 } });
      mlServiceMock.analyzeImage.mockResolvedValue({ safe: true, labels: [], score: 0 });
      caseModelMock.create.mockResolvedValue(mockCase);
      producerMock.publishContentFlagged.mockResolvedValue(undefined);

      const result = await service.analyzeContent(entityId, 'POST', 'Borderline content', []);

      expect(caseModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING' }),
      );
      expect(producerMock.publishContentFlagged).toHaveBeenCalled();
      expect(decisionModelMock.create).not.toHaveBeenCalled();
      expect(result.status).toBe('PENDING');
    });

    it('should publish content_flagged Kafka event on flag', async () => {
      const entityId = 'flagged-post';
      const mockCase = createModerationCaseFixture({ entity_id: entityId, ml_score: 0.6, status: 'PENDING' });

      mlServiceMock.analyzeText.mockResolvedValue({ score: 0.6, categories: { toxicity: 0.6 } });
      mlServiceMock.analyzeImage.mockResolvedValue({ safe: true, labels: [], score: 0 });
      caseModelMock.create.mockResolvedValue(mockCase);
      producerMock.publishContentFlagged.mockResolvedValue(undefined);

      await service.analyzeContent(entityId, 'POST', 'Flagged content', []);

      expect(producerMock.publishContentFlagged).toHaveBeenCalledWith(
        entityId, 'POST', 0.6, { toxicity: 0.6 }, mockCase.id,
      );
    });

    it('should use max score between text and image analysis', async () => {
      const entityId = 'media-post';
      const mockCase = createModerationCaseFixture({ entity_id: entityId, ml_score: 0.9, status: 'RESOLVED' });

      mlServiceMock.analyzeText.mockResolvedValue({ score: 0.1, categories: { toxicity: 0.1 } });
      mlServiceMock.analyzeImage.mockResolvedValue({ safe: false, labels: ['explicit'], score: 0.9 });
      caseModelMock.create.mockResolvedValue(mockCase);
      decisionModelMock.create.mockResolvedValue(createDecisionFixture({ decision: 'REJECTED' }));
      producerMock.publishContentRejected.mockResolvedValue(undefined);

      await service.analyzeContent(entityId, 'POST', 'Clean text', ['http://img.example.com/photo.jpg']);

      expect(caseModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ ml_score: 0.9 }),
      );
    });
  });

  describe('createCase', () => {
    it('should create moderation_case with PENDING status', async () => {
      const mockCase = createModerationCaseFixture({ reason: 'USER_REPORT', status: 'PENDING' });
      caseModelMock.create.mockResolvedValue(mockCase);

      const result = await service.createCase({
        entity_id: mockCase.entity_id,
        entity_type: 'POST',
        reason: 'USER_REPORT',
      });

      expect(caseModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'USER_REPORT', status: 'PENDING' }),
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('getCaseById', () => {
    it('should return moderation case for valid id', async () => {
      const mockCase = createModerationCaseFixture();
      caseModelMock.findById.mockResolvedValue(mockCase);

      const result = await service.getCaseById(mockCase.id);
      expect(result).toEqual(mockCase);
    });

    it('should throw NotFoundError for non-existent case', async () => {
      caseModelMock.findById.mockResolvedValue(null);

      await expect(service.getCaseById('non-existent')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('resolveCase', () => {
    it('should update case status and publish content_approved event on resolve', async () => {
      const mockCase = createModerationCaseFixture({ status: 'PENDING' });
      const mockDecision = createDecisionFixture({ decision: 'APPROVED', case_id: mockCase.id });

      caseModelMock.findById.mockResolvedValue(mockCase);
      decisionModelMock.create.mockResolvedValue(mockDecision);
      caseModelMock.updateStatus.mockResolvedValue({ ...mockCase, status: 'RESOLVED' });
      producerMock.publishContentApproved.mockResolvedValue(undefined);

      const result = await service.resolveCase(
        mockCase.id,
        { decision: 'APPROVED', reason: 'Content is fine' },
        'moderator-uuid',
      );

      expect(caseModelMock.updateStatus).toHaveBeenCalledWith(mockCase.id, 'RESOLVED', expect.any(Date));
      expect(producerMock.publishContentApproved).toHaveBeenCalledWith(
        mockCase.entity_id, mockCase.entity_type, mockCase.id, 'moderator-uuid',
      );
      expect(result).toEqual(mockDecision);
    });

    it('should publish content_rejected event when decision is REJECTED', async () => {
      const mockCase = createModerationCaseFixture({ status: 'PENDING' });
      const mockDecision = createDecisionFixture({ decision: 'REJECTED', case_id: mockCase.id });

      caseModelMock.findById.mockResolvedValue(mockCase);
      decisionModelMock.create.mockResolvedValue(mockDecision);
      caseModelMock.updateStatus.mockResolvedValue({ ...mockCase, status: 'RESOLVED' });
      producerMock.publishContentRejected.mockResolvedValue(undefined);

      await service.resolveCase(mockCase.id, { decision: 'REJECTED', reason: 'Violates ToS' }, 'mod-id');

      expect(producerMock.publishContentRejected).toHaveBeenCalledWith(
        mockCase.entity_id, mockCase.entity_type, mockCase.id, 'mod-id', 'Violates ToS',
      );
    });

    it('should throw ForbiddenError if case is already resolved', async () => {
      const resolvedCase = createModerationCaseFixture({ status: 'RESOLVED' });
      caseModelMock.findById.mockResolvedValue(resolvedCase);

      await expect(
        service.resolveCase(resolvedCase.id, { decision: 'APPROVED' }, 'moderator-uuid'),
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    });

    it('should throw NotFoundError if case does not exist', async () => {
      caseModelMock.findById.mockResolvedValue(null);

      await expect(
        service.resolveCase('non-existent', { decision: 'APPROVED' }, 'mod-id'),
      ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    });
  });

  describe('assignCase', () => {
    it('should assign case to moderator and set status IN_REVIEW', async () => {
      const mockCase = createModerationCaseFixture({ status: 'PENDING' });
      const updatedCase = { ...mockCase, assigned_to: 'mod-id', status: 'IN_REVIEW' as const };

      caseModelMock.findById.mockResolvedValue(mockCase);
      caseModelMock.assignToModerator.mockResolvedValue(updatedCase);

      const result = await service.assignCase(mockCase.id, 'mod-id');

      expect(caseModelMock.assignToModerator).toHaveBeenCalledWith(mockCase.id, 'mod-id');
      expect(result.assigned_to).toBe('mod-id');
    });

    it('should throw NotFoundError if case does not exist', async () => {
      caseModelMock.findById.mockResolvedValue(null);

      await expect(service.assignCase('non-existent', 'mod-id')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });
});
