import { appealModel } from '../models/appeal.model';
import { moderationCaseModel } from '../models/moderationCase.model';
import { moderationDecisionModel } from '../models/moderationDecision.model';
import { moderationProducer } from '../kafka/producers/moderation.producer';
import { appealsTotal } from '../utils/metrics';
import { logger } from '../utils/logger';
import {
  Appeal,
  CreateAppealDto,
  ResolveAppealDto,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../types';

export class AppealService {
  async createAppeal(userId: string, dto: CreateAppealDto): Promise<Appeal> {
    // Verify the case exists
    const moderationCase = await moderationCaseModel.findById(dto.case_id);
    if (!moderationCase) throw new NotFoundError('Moderation case');

    // Only resolved (rejected) cases can be appealed
    if (moderationCase.status !== 'RESOLVED') {
      throw new ForbiddenError('Only resolved cases can be appealed');
    }

    // Check no existing pending appeal
    const alreadyExists = await appealModel.existsForUserAndCase(userId, dto.case_id);
    if (alreadyExists) {
      throw new ConflictError('You have already submitted an appeal for this case');
    }

    const appeal = await appealModel.create(userId, dto);
    appealsTotal.inc();

    logger.info('Appeal created', { appealId: appeal.id, caseId: dto.case_id, userId });

    return appeal;
  }

  async getAppeal(id: string): Promise<Appeal> {
    const appeal = await appealModel.findById(id);
    if (!appeal) throw new NotFoundError('Appeal');
    return appeal;
  }

  async getAppealsByUser(userId: string, limit = 20, offset = 0): Promise<Appeal[]> {
    return appealModel.findByUserId(userId, limit, offset);
  }

  async getPendingAppeals(limit = 20, offset = 0): Promise<Appeal[]> {
    return appealModel.findPending(limit, offset);
  }

  async resolveAppeal(
    appealId: string,
    dto: ResolveAppealDto,
    resolvedBy: string,
  ): Promise<Appeal> {
    const appeal = await appealModel.findById(appealId);
    if (!appeal) throw new NotFoundError('Appeal');

    if (appeal.status !== 'PENDING') {
      throw new ForbiddenError('Appeal is already resolved');
    }

    const updated = await appealModel.updateStatus(appealId, dto.status);
    if (!updated) throw new NotFoundError('Appeal');

    if (dto.status === 'GRANTED') {
      // Re-open the case and auto-approve it
      const moderationCase = await moderationCaseModel.findById(appeal.case_id);
      if (moderationCase) {
        await moderationDecisionModel.create(
          appeal.case_id,
          { decision: 'APPROVED', reason: 'Appeal granted' },
          resolvedBy,
        );
        await moderationProducer.publishContentApproved(
          moderationCase.entity_id,
          moderationCase.entity_type,
          appeal.case_id,
          resolvedBy,
        );
      }
    }

    logger.info('Appeal resolved', { appealId, status: dto.status, resolvedBy });

    return updated;
  }
}

export const appealService = new AppealService();
