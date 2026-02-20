import { Request, Response } from 'express';
import { moderationService } from '../services/moderation.service';
import { EntityType, CaseStatus } from '../types';

export class ModerationController {
  async reportContent(req: Request, res: Response): Promise<void> {
    const { entity_id, entity_type, reason, content, media_urls } = req.body as {
      entity_id: string;
      entity_type: EntityType;
      reason: 'USER_REPORT';
      content?: string;
      media_urls?: string[];
    };

    const moderationCase = await moderationService.createCase({
      entity_id,
      entity_type,
      reason,
      content,
      media_urls,
    });

    res.status(201).json({ success: true, data: moderationCase });
  }

  async getCaseById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const moderationCase = await moderationService.getCaseById(id);
    res.json({ success: true, data: moderationCase });
  }

  async getCasesByEntity(req: Request, res: Response): Promise<void> {
    const { entityId } = req.params;
    const { entity_type } = req.query as { entity_type?: EntityType };
    const cases = await moderationService.getCasesByEntity(entityId, entity_type);
    res.json({ success: true, data: cases });
  }

  async getCasesByStatus(req: Request, res: Response): Promise<void> {
    const { status } = req.params as { status: CaseStatus };
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);
    const cases = await moderationService.getCasesByStatus(status, limit, offset);
    res.json({ success: true, data: cases });
  }

  async resolveCase(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { decision, reason } = req.body as { decision: string; reason?: string };
    const decidedBy = req.user!.userId;

    const result = await moderationService.resolveCase(
      id,
      { decision: decision as any, reason },
      decidedBy,
    );

    res.json({ success: true, data: result });
  }

  async assignCase(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const moderatorId = req.user!.userId;

    const updated = await moderationService.assignCase(id, moderatorId);
    res.json({ success: true, data: updated });
  }
}

export const moderationController = new ModerationController();
