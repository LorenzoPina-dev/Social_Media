import { Request, Response } from 'express';
import { appealService } from '../services/appeal.service';

export class AppealController {
  async createAppeal(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { case_id, reason } = req.body as { case_id: string; reason: string };

    const appeal = await appealService.createAppeal(userId, { case_id, reason });
    res.status(201).json({ success: true, data: appeal });
  }

  async getAppeal(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const appeal = await appealService.getAppeal(id);
    res.json({ success: true, data: appeal });
  }

  async getMyAppeals(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);

    const appeals = await appealService.getAppealsByUser(userId, limit, offset);
    res.json({ success: true, data: appeals });
  }

  async getPendingAppeals(req: Request, res: Response): Promise<void> {
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);

    const appeals = await appealService.getPendingAppeals(limit, offset);
    res.json({ success: true, data: appeals });
  }

  async resolveAppeal(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status } = req.body as { status: 'GRANTED' | 'DENIED' };
    const resolvedBy = req.user!.userId;

    const appeal = await appealService.resolveAppeal(id, { status }, resolvedBy);
    res.json({ success: true, data: appeal });
  }
}

export const appealController = new AppealController();
