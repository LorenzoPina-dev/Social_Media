/**
 * Post Events Consumer
 */

import { feedService } from '../../services/feed.service';
import { fetchFollowerIds } from '../../services/http.service';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import type { KafkaEvent, PostCreatedPayload, PostDeletedPayload } from '../../types';

export async function handlePostEvent(event: KafkaEvent): Promise<void> {
  const label = { topic: 'post_events', event_type: event.type };

  try {
    switch (event.type) {
      case 'post_created':
        await onPostCreated(event);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
        break;

      case 'post_deleted':
        await onPostDeleted(event);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
        break;

      case 'post_updated':
        logger.debug('post_updated — no feed action', { postId: event.entityId });
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'skipped' });
        break;

      default:
        logger.warn('Unknown post event type', { type: event.type });
    }
  } catch (err) {
    logger.error('Error handling post event', { event, err });
    metrics.incrementCounter('kafka_message_processed', { ...label, status: 'error' });
  }
}

async function onPostCreated(event: KafkaEvent): Promise<void> {
  const payload = event.payload as unknown as PostCreatedPayload;
  const postId = event.entityId;
  const authorId = event.userId;

  if (payload.visibility === 'PRIVATE') {
    logger.debug('Skipping private post fan-out', { postId });
    return;
  }

  const createdAtMs = new Date(event.timestamp).getTime();
  const score = feedService.calculateScore(createdAtMs);

  const { followerIds, followerCount } = await fetchFollowerIds(authorId);

  if (followerCount > config.FEED.CELEBRITY_THRESHOLD) {
    logger.info('Celebrity user — skipping write fan-out', { authorId, followerCount });
    await feedService.addPostToFeed(authorId, postId, score);
    return;
  }

  const recipients = [...new Set([...followerIds, authorId])];
  await feedService.fanOutPost(recipients, postId, score);
}

async function onPostDeleted(event: KafkaEvent): Promise<void> {
  const payload = event.payload as unknown as PostDeletedPayload;
  const postId = event.entityId;
  const authorId = payload.userId ?? event.userId;

  const { followerIds } = await fetchFollowerIds(authorId);
  const recipients = [...new Set([...followerIds, authorId])];

  await feedService.removePostFromFeeds(recipients, postId);
}
