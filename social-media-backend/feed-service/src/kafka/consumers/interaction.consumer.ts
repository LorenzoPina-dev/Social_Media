/**
 * Interaction Events Consumer
 *
 * Responsibilities:
 *  - like_created   → boost post score in follower feed ZSETs
 *                     + HINCRBY like_count in post_data hash
 *  - like_deleted   → reduce score + HINCRBY -1
 *  - share_created  → boost score + HINCRBY share_count
 *  - comment_created → boost score + HINCRBY comment_count
 */

import { feedService } from '../../services/feed.service';
import { storeService } from '../../services/store.service';
import { fetchFollowerIds } from '../../services/http.service';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import type { KafkaEvent, LikeCreatedPayload } from '../../types';

// Feed score deltas (must match calculateScore weights in feed.service)
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
        // Decrement comment count in the denormalized store
        await storeService.adjustPostCounter(event.entityId, 'commentCount', -1);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
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

  // Boost ranking score in feed ZSETs
  await feedService.boostPostInFeeds(followerIds, postId, LIKE_DELTA);

  // Increment like counter in denormalized post data
  await storeService.adjustPostCounter(postId, 'likeCount', 1);
}

async function onLikeDeleted(event: KafkaEvent): Promise<void> {
  const postId = event.entityId;
  const { followerIds } = await fetchFollowerIds(event.userId);

  await feedService.boostPostInFeeds(followerIds, postId, -LIKE_DELTA);
  await storeService.adjustPostCounter(postId, 'likeCount', -1);
}

async function onShareCreated(event: KafkaEvent): Promise<void> {
  const postId = event.entityId;
  const { followerIds } = await fetchFollowerIds(event.userId);

  await feedService.boostPostInFeeds(followerIds, postId, SHARE_DELTA);
  await storeService.adjustPostCounter(postId, 'shareCount', 1);
}

async function onCommentCreated(event: KafkaEvent): Promise<void> {
  const postId = event.entityId;
  const { followerIds } = await fetchFollowerIds(event.userId);

  await feedService.boostPostInFeeds(followerIds, postId, COMMENT_DELTA);
  await storeService.adjustPostCounter(postId, 'commentCount', 1);
}
