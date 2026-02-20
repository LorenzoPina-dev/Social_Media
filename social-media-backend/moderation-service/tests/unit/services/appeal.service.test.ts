import { AppealService } from '../../../src/services/appeal.service';
import { appealModel } from '../../../src/models/appeal.model';
import { moderationCaseModel } from '../../../src/models/moderationCase.model';
import { moderationDecisionModel } from '../../../src/models/moderationDecision.model';
import { moderationProducer } from '../../../src/kafka/producers/moderation.producer';
import { createModerationCaseFixture, createAppealFixture } from '../../fixtures';

jest.mock('../../../src/models/appeal.model');
jest.mock('../../../src/models/moderationCase.model');
jest.mock('../../../src/models/moderationDecision.model');
jest.mock('../../../src/kafka/producers/moderation.producer');
jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/utils/metrics', () => ({
  appealsTotal: { inc: jest.fn() },
}));

const appealModelMock = appealModel as jest.Mocked<typeof appealModel>;
const caseModelMock = moderationCaseModel as jest.Mocked<typeof moderationCaseModel>;
const decisionModelMock = moderationDecisionModel as jest.Mocked<typeof moderationDecisionModel>;
const producerMock = moderationProducer as jest.Mocked<typeof moderationProducer>;

describe('AppealService', () => {
  let service: AppealService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AppealService();
  });

  describe('createAppeal', () => {
    it('should create appeal record and set status PENDING', async () => {
      const mockCase = createModerationCaseFixture({ status: 'RESOLVED' });
      const mockAppeal = createAppealFixture({ case_id: mockCase.id, status: 'PENDING' });

      caseModelMock.findById.mockResolvedValue(mockCase);
      appealModelMock.existsForUserAndCase.mockResolvedValue(false);
      appealModelMock.create.mockResolvedValue(mockAppeal);

      const result = await service.createAppeal('user-id', {
        case_id: mockCase.id,
        reason: 'I believe this was wrongly rejected',
      });

      expect(appealModelMock.create).toHaveBeenCalledWith('user-id', {
        case_id: mockCase.id,
        reason: 'I believe this was wrongly rejected',
      });
      expect(result).toEqual(mockAppeal);
    });

    it('should throw NotFoundError if moderation case does not exist', async () => {
      caseModelMock.findById.mockResolvedValue(null);

      await expect(
        service.createAppeal('user-id', { case_id: 'non-existent', reason: 'Test' }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    });

    it('should throw ForbiddenError if case is not yet resolved', async () => {
      const pendingCase = createModerationCaseFixture({ status: 'PENDING' });
      caseModelMock.findById.mockResolvedValue(pendingCase);

      await expect(
        service.createAppeal('user-id', { case_id: pendingCase.id, reason: 'Test' }),
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    });

    it('should throw ConflictError if user already has a pending appeal for this case', async () => {
      const resolvedCase = createModerationCaseFixture({ status: 'RESOLVED' });
      caseModelMock.findById.mockResolvedValue(resolvedCase);
      appealModelMock.existsForUserAndCase.mockResolvedValue(true);

      await expect(
        service.createAppeal('user-id', { case_id: resolvedCase.id, reason: 'Duplicate' }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    });
  });

  describe('getAppeal', () => {
    it('should return appeal for valid id', async () => {
      const mockAppeal = createAppealFixture();
      appealModelMock.findById.mockResolvedValue(mockAppeal);

      const result = await service.getAppeal(mockAppeal.id);
      expect(result).toEqual(mockAppeal);
    });

    it('should throw NotFoundError for non-existent appeal', async () => {
      appealModelMock.findById.mockResolvedValue(null);

      await expect(service.getAppeal('non-existent')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('resolveAppeal', () => {
    it('should grant appeal and auto-approve the underlying case', async () => {
      const mockCase = createModerationCaseFixture({ status: 'RESOLVED' });
      const mockAppeal = createAppealFixture({ case_id: mockCase.id, status: 'PENDING' });
      const updatedAppeal = { ...mockAppeal, status: 'GRANTED' as const };

      appealModelMock.findById.mockResolvedValue(mockAppeal);
      appealModelMock.updateStatus.mockResolvedValue(updatedAppeal);
      caseModelMock.findById.mockResolvedValue(mockCase);
      decisionModelMock.create.mockResolvedValue({} as any);
      producerMock.publishContentApproved.mockResolvedValue(undefined);

      const result = await service.resolveAppeal(mockAppeal.id, { status: 'GRANTED' }, 'admin-id');

      expect(decisionModelMock.create).toHaveBeenCalledWith(
        mockAppeal.case_id,
        expect.objectContaining({ decision: 'APPROVED', reason: 'Appeal granted' }),
        'admin-id',
      );
      expect(producerMock.publishContentApproved).toHaveBeenCalled();
      expect(result.status).toBe('GRANTED');
    });

    it('should deny appeal without additional actions', async () => {
      const mockAppeal = createAppealFixture({ status: 'PENDING' });
      const deniedAppeal = { ...mockAppeal, status: 'DENIED' as const };

      appealModelMock.findById.mockResolvedValue(mockAppeal);
      appealModelMock.updateStatus.mockResolvedValue(deniedAppeal);

      const result = await service.resolveAppeal(mockAppeal.id, { status: 'DENIED' }, 'admin-id');

      expect(decisionModelMock.create).not.toHaveBeenCalled();
      expect(producerMock.publishContentApproved).not.toHaveBeenCalled();
      expect(result.status).toBe('DENIED');
    });

    it('should throw ForbiddenError if appeal is already resolved', async () => {
      const resolvedAppeal = createAppealFixture({ status: 'GRANTED' });
      appealModelMock.findById.mockResolvedValue(resolvedAppeal);

      await expect(
        service.resolveAppeal(resolvedAppeal.id, { status: 'DENIED' }, 'admin-id'),
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    });

    it('should throw NotFoundError if appeal does not exist', async () => {
      appealModelMock.findById.mockResolvedValue(null);

      await expect(
        service.resolveAppeal('non-existent', { status: 'DENIED' }, 'admin-id'),
      ).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    });
  });
});
