import { config } from '../config';
import { logger } from '../utils/logger';
import { casesCreatedTotal, decisionsTotal } from '../utils/metrics';
import { moderationCaseModel } from '../models/moderationCase.model';
import { moderationDecisionModel } from '../models/moderationDecision.model';
import { mlService } from './ml.service';
import { moderationProducer } from '../kafka/producers/moderation.producer';
import {
  ModerationCase,
  ModerationDecision,
  EntityType,
  CaseStatus,
  CreateModerationCaseDto,
  ResolveDecisionDto,
  NotFoundError,
  ForbiddenError,
} from '../types';

export class ModerationService {
  /**
   * Main entry point for async content analysis.
   * Called by the Kafka consumer on post_created events.
   */
  async analyzeContent(
    entityId: string,
    entityType: EntityType,
    content: string,
    mediaUrls: string[] = [],
  ): Promise<ModerationCase> {
    logger.info('Analyzing content', { entityId, entityType });

    // Run text analysis
    const textResult = await mlService.analyzeText(content);

    // Run image analysis if media present
    let imageScore = 0;
    for (const url of mediaUrls) {
      const imgResult = await mlService.analyzeImage(url);
      if (!imgResult.safe) {
        imageScore = Math.max(imageScore, imgResult.score);
      }
    }

    const finalScore = Math.max(textResult.score, imageScore);

    let status: CaseStatus;
    if (finalScore >= config.ml.autoRejectThreshold) {
      status = 'RESOLVED';
    } else if (finalScore < config.ml.autoApproveThreshold) {
      status = 'RESOLVED';
    } else {
      status = 'PENDING'; // Needs human review
    }

    const moderationCase = await moderationCaseModel.create({
      entity_id: entityId,
      entity_type: entityType,
      reason: 'AUTO_FLAGGED',
      ml_score: finalScore,
      ml_categories: textResult.categories,
      status,
    });

    casesCreatedTotal.inc({ reason: 'AUTO_FLAGGED', entity_type: entityType });

    if (finalScore >= config.ml.autoRejectThreshold) {
      // Auto-reject
      await moderationDecisionModel.create(
        moderationCase.id,
        { decision: 'REJECTED', reason: 'Automated ML rejection — toxicity score above threshold' },
        null, // decided_by null = automated
      );
      decisionsTotal.inc({ decision: 'REJECTED' });

      await moderationProducer.publishContentRejected(
        entityId,
        entityType,
        moderationCase.id,
        null,
        'Automated ML rejection — toxicity score above threshold',
      );

      logger.info('Content auto-rejected', { entityId, score: finalScore });
    } else if (finalScore < config.ml.autoApproveThreshold) {
      // Auto-approve
      await moderationDecisionModel.create(
        moderationCase.id,
        { decision: 'APPROVED', reason: 'Automated ML approval' },
        null,
      );
      decisionsTotal.inc({ decision: 'APPROVED' });

      await moderationProducer.publishContentApproved(
        entityId,
        entityType,
        moderationCase.id,
        null,
      );

      logger.info('Content auto-approved', { entityId, score: finalScore });
    } else {
      // Needs human review — publish flagged event
      await moderationProducer.publishContentFlagged(
        entityId,
        entityType,
        finalScore,
        textResult.categories,
        moderationCase.id,
      );

      logger.info('Content flagged for human review', { entityId, score: finalScore });
    }

    return moderationCase;
  }

  /**
   * Create a manual moderation case (via user report or admin).
   */
  async createCase(dto: CreateModerationCaseDto): Promise<ModerationCase> {
    const moderationCase = await moderationCaseModel.create({
      entity_id: dto.entity_id,
      entity_type: dto.entity_type,
      reason: dto.reason,
      status: 'PENDING',
    });

    casesCreatedTotal.inc({ reason: dto.reason, entity_type: dto.entity_type });

    if (dto.content || (dto.media_urls && dto.media_urls.length > 0)) {
      // Async ML analysis for reported content
      setImmediate(() => {
        this.analyzeContent(
          dto.entity_id,
          dto.entity_type,
          dto.content ?? '',
          dto.media_urls ?? [],
        ).catch((err) => logger.error('Async ML analysis failed', { error: err }));
      });
    }

    return moderationCase;
  }

  async getCaseById(id: string): Promise<ModerationCase> {
    const moderationCase = await moderationCaseModel.findById(id);
    if (!moderationCase) throw new NotFoundError('Moderation case');
    return moderationCase;
  }

  async getCasesByEntity(entityId: string, entityType?: EntityType): Promise<ModerationCase[]> {
    return moderationCaseModel.findByEntityId(entityId, entityType);
  }

  async getCasesByStatus(
    status: CaseStatus,
    limit = 20,
    offset = 0,
  ): Promise<ModerationCase[]> {
    return moderationCaseModel.findByStatus(status, limit, offset);
  }

  async resolveCase(
    caseId: string,
    dto: ResolveDecisionDto,
    decidedBy: string,
  ): Promise<ModerationDecision> {
    const moderationCase = await moderationCaseModel.findById(caseId);
    if (!moderationCase) throw new NotFoundError('Moderation case');
    if (moderationCase.status === 'RESOLVED') {
      throw new ForbiddenError('Case is already resolved');
    }

    const decision = await moderationDecisionModel.create(caseId, dto, decidedBy);
    await moderationCaseModel.updateStatus(caseId, 'RESOLVED', new Date());

    decisionsTotal.inc({ decision: dto.decision });

    if (dto.decision === 'APPROVED') {
      await moderationProducer.publishContentApproved(
        moderationCase.entity_id,
        moderationCase.entity_type,
        caseId,
        decidedBy,
      );
    } else if (dto.decision === 'REJECTED') {
      await moderationProducer.publishContentRejected(
        moderationCase.entity_id,
        moderationCase.entity_type,
        caseId,
        decidedBy,
        dto.reason,
      );
    }

    return decision;
  }

  async assignCase(caseId: string, moderatorId: string): Promise<ModerationCase> {
    const moderationCase = await moderationCaseModel.findById(caseId);
    if (!moderationCase) throw new NotFoundError('Moderation case');

    const updated = await moderationCaseModel.assignToModerator(caseId, moderatorId);
    if (!updated) throw new NotFoundError('Moderation case');
    return updated;
  }
}

export const moderationService = new ModerationService();
