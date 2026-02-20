import { moderationCaseModel } from '../models/moderationCase.model';
import { moderationDecisionModel } from '../models/moderationDecision.model';
import { logger } from '../utils/logger';
import { ModerationCase, ModerationDecision, CaseStatus, NotFoundError } from '../types';

export class ReviewService {
  async getQueue(status: CaseStatus = 'PENDING', limit = 20, offset = 0): Promise<ModerationCase[]> {
    return moderationCaseModel.findByStatus(status, limit, offset);
  }

  async getCaseWithDecisions(
    caseId: string,
  ): Promise<{ case: ModerationCase; decisions: ModerationDecision[] }> {
    const moderationCase = await moderationCaseModel.findById(caseId);
    if (!moderationCase) throw new NotFoundError('Moderation case');

    const decisions = await moderationDecisionModel.findByCaseId(caseId);
    return { case: moderationCase, decisions };
  }

  async countPendingCases(): Promise<number> {
    return moderationCaseModel.countByStatus('PENDING');
  }

  async getStats(): Promise<{
    pending: number;
    in_review: number;
    resolved: number;
  }> {
    const [pending, in_review, resolved] = await Promise.all([
      moderationCaseModel.countByStatus('PENDING'),
      moderationCaseModel.countByStatus('IN_REVIEW'),
      moderationCaseModel.countByStatus('RESOLVED'),
    ]);

    logger.debug('Review stats fetched', { pending, in_review, resolved });

    return { pending, in_review, resolved };
  }
}

export const reviewService = new ReviewService();
