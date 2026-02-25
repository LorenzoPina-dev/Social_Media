/**
 * Routes Index — Post Service
 *
 * Le istanze di Model/Service/Producer sono create UNA SOLA VOLTA
 * qui e poi esportate via getSharedInstances() per essere riusate da
 * Kafka consumers e Scheduler in app.ts.
 */

import { Application } from 'express';
import { setupPostRoutes, setupUserPostRoutes } from './post.routes';

import { PostController } from '../controllers/post.controller';
import { PostService } from '../services/post.service';
import { HashtagService } from '../services/hashtag.service';
import { CacheService } from '../services/cache.service';

import { PostModel } from '../models/post.model';
import { HashtagModel } from '../models/hashtag.model';
import { EditHistoryModel } from '../models/editHistory.model';
import { SavedPostModel } from '../models/savedPost.model';

import { PostProducer } from '../kafka/producers/post.producer';
import { logger } from '../utils/logger';
import { fail } from '@social-media/shared';

// ─── Shared instances (singleton per processo) ────────────────────────────────

let sharedInstances: {
  postModel: PostModel;
  hashtagModel: HashtagModel;
  editHistoryModel: EditHistoryModel;
  savedPostModel: SavedPostModel;
  cacheService: CacheService;
  postProducer: PostProducer;
  hashtagService: HashtagService;
  postService: PostService;
} | null = null;

/**
 * Ritorna le istanze condivise. Deve essere chiamato DOPO setupRoutes().
 * Usato da app.ts per i Kafka consumers e lo Scheduler.
 */
export function getSharedInstances() {
  if (!sharedInstances) {
    throw new Error('getSharedInstances() chiamato prima di setupRoutes()');
  }
  return sharedInstances;
}

export function setupRoutes(app: Application): void {
  // ─── Models ──────────────────────────────────────────────────────────────
  const postModel = new PostModel();
  const hashtagModel = new HashtagModel();
  const editHistoryModel = new EditHistoryModel();
  const savedPostModel = new SavedPostModel();

  // ─── Infrastructure services ──────────────────────────────────────────────
  const cacheService = new CacheService();
  const postProducer = new PostProducer();

  // ─── Domain services ──────────────────────────────────────────────────────
  const hashtagService = new HashtagService(hashtagModel);

  const postService = new PostService(
    postModel,
    editHistoryModel,
    savedPostModel,
    hashtagService,
    cacheService,
    postProducer,
  );

  // Salva le istanze per riuso esterno (Kafka, Scheduler)
  sharedInstances = {
    postModel,
    hashtagModel,
    editHistoryModel,
    savedPostModel,
    cacheService,
    postProducer,
    hashtagService,
    postService,
  };

  // ─── Controllers ──────────────────────────────────────────────────────────
  const postController = new PostController(postService, hashtagService);

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.use('/api/v1/posts', setupPostRoutes(postController));
  app.use('/api/v1/users/:userId/posts', setupUserPostRoutes(postController));

  // 404 — intercetta tutte le route non registrate
  app.use('*', (_, res) => {
    fail(res, 404, 'NOT_FOUND', 'Route not found');
  });

  logger.info('Post routes configured successfully');
}
