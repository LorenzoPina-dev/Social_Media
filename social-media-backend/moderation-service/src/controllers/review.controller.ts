import { Request, Response } from 'express';
import { reviewService } from '../services/review.service';
import { CaseStatus } from '../types';

export class ReviewController {
  async getQueue(req: Request, res: Response): Promise<void> {
    const status = (req.query.status as CaseStatus) ?? 'PENDING';
    const limit = Number(req.query.limit ?? 20);
    const offset = Number(req.query.offset ?? 0);

    const cases = await reviewService.getQueue(status, limit, offset);
    res.json({ success: true, data: cases });
  }

  async getCaseDetails(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const result = await reviewService.getCaseWithDecisions(id);
    res.json({ success: true, data: result });
  }

  async getStats(req: Request, res: Response): Promise<void> {
    const stats = await reviewService.getStats();
    res.json({ success: true, data: stats });
  }
}

export const reviewController = new ReviewController();
