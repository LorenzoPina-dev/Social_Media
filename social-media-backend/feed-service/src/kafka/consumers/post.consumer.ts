/**
 * Post Events Consumer
 *
 * Responsibilities:
 *  1. Fan-out the post into follower feed ZSETs (existing logic)
 *  2. Persist full post data in Redis via StoreService (new — for hydration)
 */

import { feedService } from '../../services/feed.service';
import { storeService } from '../../services/store.service';
import { fetchFollowerIds } from '../../services/http.service';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import type { KafkaEvent, PostCreatedPayload, PostDeletedPayload, PostUpdatedPayload } from '../../types';

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
        await onPostUpdated(event);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
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

  // ── Step 1: persist post data for hydration ──────────────────────────────
  await storeService.savePost({
    id: postId,
    userId: authorId,
    content: payload.content,
    mediaUrls: payload.media_urls ?? [],
    mediaTypes: payload.media_types ?? [],
    visibility: payload.visibility,
    likeCount: payload.like_count ?? 0,
    commentCount: payload.comment_count ?? 0,
    shareCount: payload.share_count ?? 0,
    publishedAt: payload.published_at ?? event.timestamp,
    createdAt: payload.created_at ?? event.timestamp,
  });

  // ── Step 2: fan-out into follower feed ZSETs ──────────────────────────────
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

  // Remove from feed ZSETs
  const { followerIds } = await fetchFollowerIds(authorId);
  const recipients = [...new Set([...followerIds, authorId])];
  await feedService.removePostFromFeeds(recipients, postId);

  // Remove denormalized post data
  await storeService.deletePost(postId);
}

async function onPostUpdated(event: KafkaEvent): Promise<void> {
  const payload = event.payload as unknown as PostUpdatedPayload;
  const postId = event.entityId;

  // Update only the fields that changed in the denormalized store
  await storeService.updatePost(postId, {
    content: payload.content,
    visibility: payload.visibility,
    mediaUrls: payload.media_urls,
    mediaTypes: payload.media_types,
  });
}
