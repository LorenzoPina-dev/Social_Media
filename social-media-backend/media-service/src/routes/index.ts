import { Application } from 'express';
import { setupMediaRoutes } from './media.routes';

import { UploadController } from '../controllers/upload.controller';
import { UploadService } from '../services/upload.service';
import { ProcessingService } from '../services/processing.service';
import { StorageService } from '../services/storage.service';
import { MediaFileModel } from '../models/media.model';
import { ProcessingJobModel } from '../models/processingJob.model';
import { MediaProducer } from '../kafka/producers/media.producer';
import { PostEventConsumer } from '../kafka/consumers/post.consumer';
import { logger } from '../utils/logger';
import { fail } from '@social-media/shared';

export function setupRoutes(app: Application): void {
  // Models
  const mediaModel = new MediaFileModel();
  const jobModel = new ProcessingJobModel();

  // Infrastructure
  const storageService = new StorageService();
  const mediaProducer = new MediaProducer();

  // Services
  const processingService = new ProcessingService(mediaModel, jobModel, storageService, mediaProducer);
  const uploadService = new UploadService(mediaModel, storageService, processingService, mediaProducer);

  // Controllers
  const uploadController = new UploadController(uploadService);

  // Kafka consumers
  const postConsumer = new PostEventConsumer(mediaModel, storageService);
  postConsumer.register();

  // Routes
  app.use('/api/v1/media', setupMediaRoutes(uploadController));

  // 404
  app.use('*', (_, res) => {
    fail(res, 404, 'NOT_FOUND', 'Route not found');
  });

  logger.info('Media routes configured successfully');
}
