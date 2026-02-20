/**
 * Interaction Events Consumer
 *
 * Handles like_created, share_created → boost post score in feeds.
 * like_deleted → reduce score (best-effort).
 */

import { feedService } from '../../services/feed.service';
import { fetchFollowerIds } from '../../services/http.service';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import type { KafkaEvent, LikeCreatedPayload, ShareCreatedPayload } from '../../types';

// Engagement score deltas (must match calculateScore weights)
const LIKE_DELTA = 10;
const SHARE_DELTA = 30;
const COMMENT_DELTA = 20;

export async function handleInteractionEvent(event: KafkaEvent): Promise<void> {
  const label = { topic: 'interaction_events', event_type: event.type };

  try {
    switch (event.type) {
      case 'like_created':
        await onLikeCreated(event);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
        break;

      case 'like_deleted':
        await onLikeDeleted(event);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
        break;

      case 'share_created':
        await onShareCreated(event);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
        break;

      case 'comment_created':
        await onCommentCreated(event);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
        break;

      case 'comment_deleted':
        // Minor: reduce comment boost — skip for MVP
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'skipped' });
        break;

      default:
        logger.warn('Unknown interaction event type', { type: event.type });
    }
  } catch (err) {
    logger.error('Error handling interaction event', { event, err });
    metrics.incrementCounter('kafka_message_processed', { ...label, status: 'error' });
  }
}

async function onLikeCreated(event: KafkaEvent): Promise<void> {
  const payload = event.payload as unknown as LikeCreatedPayload;
  if (payload.targetType !== 'POST') return;

  const postId = event.entityId;
  const { followerIds } = await fetchFollowerIds(event.userId);

  // Boost the post in all follower feeds where it already exists
  await feedService.boostPostInFeeds(followerIds, postId, LIKE_DELTA);
}

async function onLikeDeleted(event: KafkaEvent): Promise<void> {
  const postId = event.entityId;
  const { followerIds } = await fetchFollowerIds(event.userId);

  // Reduce score (negative delta)
  await feedService.boostPostInFeeds(followerIds, postId, -LIKE_DELTA);
}

async function onShareCreated(event: KafkaEvent): Promise<void> {
  const payload = event.payload as unknown as ShareCreatedPayload;
  void payload; // used for type check only

  const postId = event.entityId;
  const { followerIds } = await fetchFollowerIds(event.userId);

  await feedService.boostPostInFeeds(followerIds, postId, SHARE_DELTA);
}

async function onCommentCreated(event: KafkaEvent): Promise<void> {
  const postId = event.entityId;
  const { followerIds } = await fetchFollowerIds(event.userId);

  await feedService.boostPostInFeeds(followerIds, postId, COMMENT_DELTA);
}
