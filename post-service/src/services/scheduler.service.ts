/**
 * Scheduler Service — pubblica i post schedulati (cron ogni 60s)
 *
 * Fix: la cron expression */60 nei secondi (campo 1 di 6) è tecnicamente
 * invalida perché il range dei secondi è 0-59. Sostituito con
 * setInterval() che è più affidabile e leggibile per questo use case.
 */

import { PostModel } from '../models/post.model';
import { PostProducer } from '../kafka/producers/post.producer';
import { HashtagService } from './hashtag.service';
import { CacheService } from './cache.service';
import { logger } from '../utils/logger';
import { postMetrics } from '../utils/metrics';
import { config } from '../config';

export class SchedulerService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private postModel: PostModel,
    private postProducer: PostProducer,
    private hashtagService: HashtagService,
    private cacheService: CacheService,
  ) {}

  start(): void {
    if (this.intervalHandle) {
      logger.warn('Scheduler already running — start() called twice');
      return;
    }

    this.intervalHandle = setInterval(() => {
      this.publishDuePosts().catch((err) =>
        logger.error('Scheduler error', { error: err }),
      );
    }, config.SCHEDULER_INTERVAL_MS);

    // Impedisce all'interval di bloccare il processo da solo
    if (this.intervalHandle.unref) {
      this.intervalHandle.unref();
    }

    logger.info(`📅 Scheduler started — interval: ${config.SCHEDULER_INTERVAL_MS}ms`);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('Scheduler stopped');
    }
  }

  async publishDuePosts(): Promise<void> {
    const duePosts = await this.postModel.findDueScheduledPosts();
    if (duePosts.length === 0) return;

    logger.info(`Scheduler: publishing ${duePosts.length} scheduled post(s)`);

    for (const post of duePosts) {
      try {
        // Mark as published first (idempotent: se il processo si riavvia
        // non ripubblica lo stesso post)
        await this.postModel.publishScheduled(post.id);

        // Process hashtags
        const hashtags = await this.hashtagService.processForPost(post.id, post.content);

        // Publish Kafka event
        await this.postProducer.publishPostCreated({ ...post, is_scheduled: false }, hashtags);

        // Invalidate cache
        await this.cacheService.deletePost(post.id);

        postMetrics.scheduledPostsPublished.inc();
        logger.info('Scheduled post published', { postId: post.id, userId: post.user_id });
      } catch (error) {
        logger.error('Failed to publish scheduled post', { error, postId: post.id });
        // Continue with other posts — non rilanciare, il loop deve continuare
      }
    }
  }
}
