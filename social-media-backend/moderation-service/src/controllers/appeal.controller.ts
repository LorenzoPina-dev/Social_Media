import { Request, Response } from 'express';
import { appealService } from '../services/appeal.service';
import { created, ok } from '@social-media/shared/dist/utils/http';

export class AppealController {
  async createAppeal(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { case_id, reason } = req.body as { case_id: string; reason: string };

    const appeal = await appealService.createAppeal(userId, { case_id, reason });
    created(res, appeal);
  }

  async getAppeal(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const appeal = await appealService.getAppeal(id);
    ok(res, appeal);
  }

  async getMyAppeals(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);

    const appeals = await appealService.getAppealsByUser(userId, limit, offset);
    ok(res, appeals);
  }

  async getPendingAppeals(req: Request, res: Response): Promise<void> {
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);

    const appeals = await appealService.getPendingAppeals(limit, offset);
    ok(res, appeals);
  }

  async resolveAppeal(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { status } = req.body as { status: 'GRANTED' | 'DENIED' };
    const resolvedBy = req.user!.userId;

    const appeal = await appealService.resolveAppeal(id, { status }, resolvedBy);
    ok(res, appeal);
  }
}

export const appealController = new AppealController();
