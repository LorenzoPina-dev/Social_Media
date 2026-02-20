import { ReviewService } from '../../../src/services/review.service';
import { moderationCaseModel } from '../../../src/models/moderationCase.model';
import { moderationDecisionModel } from '../../../src/models/moderationDecision.model';
import { createModerationCaseFixture, createDecisionFixture } from '../../fixtures';

jest.mock('../../../src/models/moderationCase.model');
jest.mock('../../../src/models/moderationDecision.model');
jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const caseModelMock = moderationCaseModel as jest.Mocked<typeof moderationCaseModel>;
const decisionModelMock = moderationDecisionModel as jest.Mocked<typeof moderationDecisionModel>;

describe('ReviewService', () => {
  let service: ReviewService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReviewService();
  });

  describe('getQueue', () => {
    it('should return PENDING cases by default', async () => {
      const cases = [createModerationCaseFixture(), createModerationCaseFixture()];
      caseModelMock.findByStatus.mockResolvedValue(cases);

      const result = await service.getQueue();

      expect(caseModelMock.findByStatus).toHaveBeenCalledWith('PENDING', 20, 0);
      expect(result).toEqual(cases);
    });

    it('should respect limit and offset parameters', async () => {
      caseModelMock.findByStatus.mockResolvedValue([]);

      await service.getQueue('IN_REVIEW', 10, 5);

      expect(caseModelMock.findByStatus).toHaveBeenCalledWith('IN_REVIEW', 10, 5);
    });
  });

  describe('getCaseWithDecisions', () => {
    it('should return case with all its decisions', async () => {
      const mockCase = createModerationCaseFixture();
      const decisions = [createDecisionFixture({ case_id: mockCase.id })];

      caseModelMock.findById.mockResolvedValue(mockCase);
      decisionModelMock.findByCaseId.mockResolvedValue(decisions);

      const result = await service.getCaseWithDecisions(mockCase.id);

      expect(result.case).toEqual(mockCase);
      expect(result.decisions).toEqual(decisions);
    });

    it('should throw NotFoundError for non-existent case', async () => {
      caseModelMock.findById.mockResolvedValue(null);

      await expect(service.getCaseWithDecisions('non-existent')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('getStats', () => {
    it('should return counts for all statuses', async () => {
      caseModelMock.countByStatus
        .mockResolvedValueOnce(5)   // PENDING
        .mockResolvedValueOnce(3)   // IN_REVIEW
        .mockResolvedValueOnce(100); // RESOLVED

      const result = await service.getStats();

      expect(result).toEqual({ pending: 5, in_review: 3, resolved: 100 });
    });

    it('should call countByStatus for each status in parallel', async () => {
      caseModelMock.countByStatus.mockResolvedValue(0);

      await service.getStats();

      expect(caseModelMock.countByStatus).toHaveBeenCalledTimes(3);
      expect(caseModelMock.countByStatus).toHaveBeenCalledWith('PENDING');
      expect(caseModelMock.countByStatus).toHaveBeenCalledWith('IN_REVIEW');
      expect(caseModelMock.countByStatus).toHaveBeenCalledWith('RESOLVED');
    });
  });

  describe('countPendingCases', () => {
    it('should return the count of pending cases', async () => {
      caseModelMock.countByStatus.mockResolvedValue(7);

      const result = await service.countPendingCases();

      expect(result).toBe(7);
      expect(caseModelMock.countByStatus).toHaveBeenCalledWith('PENDING');
    });
  });
});
