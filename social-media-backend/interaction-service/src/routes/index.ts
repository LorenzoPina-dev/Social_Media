/**
 * Routes Index — Wire all routes
 */

import { Application } from 'express';
import { LikeModel } from '../models/like.model';
import { CommentModel } from '../models/comment.model';
import { ShareModel } from '../models/share.model';
import { LikeService } from '../services/like.service';
import { CommentService } from '../services/comment.service';
import { ShareService } from '../services/share.service';
import { CounterService } from '../services/counter.service';
import { InteractionProducer } from '../kafka/producers/interaction.producer';
import { LikeController } from '../controllers/like.controller';
import { CommentController } from '../controllers/comment.controller';
import { ShareController } from '../controllers/share.controller';
import { setupLikeRoutes } from './like.routes';
import { setupCommentRoutes } from './comment.routes';
import { setupShareRoutes } from './share.routes';
import { logger } from '../utils/logger';

export function setupRoutes(app: Application): void {
  // Models
  const likeModel = new LikeModel();
  const commentModel = new CommentModel();
  const shareModel = new ShareModel();

  // Infrastructure
  const counterService = new CounterService();
  const producer = new InteractionProducer();

  // Services
  const likeService = new LikeService(likeModel, commentModel, counterService, producer);
  const commentService = new CommentService(commentModel, likeModel, counterService, producer);
  const shareService = new ShareService(shareModel, producer);

  // Controllers
  const likeController = new LikeController(likeService);
  const commentController = new CommentController(commentService);
  const shareController = new ShareController(shareService);

  // Mount routes under /api/v1
  app.use('/api/v1', setupLikeRoutes(likeController));
  app.use('/api/v1', setupCommentRoutes(commentController));
  app.use('/api/v1', setupShareRoutes(shareController));

  // 404
  app.use('*', (_, res) => {
    res.status(404).json({ success: false, error: 'Route not found', code: 'NOT_FOUND' });
  });

  logger.info('Routes configured successfully');
}
