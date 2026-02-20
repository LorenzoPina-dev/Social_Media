import { Router } from 'express';
import { moderationRoutes } from './moderation.routes';
import { reviewRoutes } from './review.routes';
import { appealRoutes } from './appeal.routes';

export const router = Router();

router.use('/moderation', moderationRoutes);
router.use('/review', reviewRoutes);
router.use('/appeals', appealRoutes);
