import { getProducer } from '../../config/kafka';
import { logger } from '../../utils/logger';
import { EntityType } from '../../types';

const TOPIC = 'moderation_events';

class ModerationProducer {
  async publishContentFlagged(
    entityId: string,
    entityType: EntityType,
    mlScore: number,
    mlCategories: Record<string, number>,
    caseId: string,
  ): Promise<void> {
    await this.publish('content_flagged', entityId, {
      entityType,
      mlScore,
      mlCategories,
      caseId,
    });
  }

  async publishContentApproved(
    entityId: string,
    entityType: EntityType,
    caseId: string,
    decidedBy: string | null,
  ): Promise<void> {
    await this.publish('content_approved', entityId, {
      entityType,
      caseId,
      decidedBy,
    });
  }

  async publishContentRejected(
    entityId: string,
    entityType: EntityType,
    caseId: string,
    decidedBy: string | null,
    reason?: string | null,
  ): Promise<void> {
    await this.publish('content_rejected', entityId, {
      entityType,
      caseId,
      decidedBy,
      reason: reason ?? null,
    });
  }

  private async publish(
    type: string,
    entityId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const producer = await getProducer();
    const event = {
      type,
      entityId,
      userId: 'system',
      timestamp: new Date().toISOString(),
      payload,
    };

    await producer.send({
      topic: TOPIC,
      messages: [
        {
          key: entityId,
          value: JSON.stringify(event),
        },
      ],
    });

    logger.info('Kafka event published', { topic: TOPIC, type, entityId });
  }
}

export const moderationProducer = new ModerationProducer();
