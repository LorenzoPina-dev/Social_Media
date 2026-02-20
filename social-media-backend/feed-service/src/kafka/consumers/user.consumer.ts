/**
 * User Events Consumer
 *
 * Handles:
 *  - user_deleted      → delete the user's own feed
 *  - follow_created    → add the followed user's recent posts to follower's feed
 *  - follow_deleted    → remove posts authored by the unfollowed user from the follower's feed
 */

import { feedService } from '../../services/feed.service';
import { fetchFollowerIds, fetchUserRecentPostIds } from '../../services/http.service';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import type { KafkaEvent, FollowCreatedPayload, FollowDeletedPayload } from '../../types';

export async function handleUserEvent(event: KafkaEvent): Promise<void> {
  const label = { topic: 'user_events', event_type: event.type };

  try {
    switch (event.type) {
      case 'user_deleted':
        await onUserDeleted(event);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
        break;

      case 'follow_created':
        await onFollowCreated(event);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
        break;

      case 'follow_deleted':
        await onFollowDeleted(event);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
        break;

      case 'user_updated':
        // No feed action needed for profile updates
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'skipped' });
        break;

      default:
        logger.warn('Unknown user event type', { type: event.type });
    }
  } catch (err) {
    logger.error('Error handling user event', { event, err });
    metrics.incrementCounter('kafka_message_processed', { ...label, status: 'error' });
  }
}

async function onUserDeleted(event: KafkaEvent): Promise<void> {
  const userId = event.entityId;

  // Clear the deleted user's own feed
  await feedService.clearFeed(userId);

  // Remove their posts from all follower feeds
  const postIds = await fetchUserRecentPostIds(userId, 1000);
  const { followerIds } = await fetchFollowerIds(userId);

  if (postIds.length > 0 && followerIds.length > 0) {
    await feedService.removePostFromFeeds(followerIds, postIds[0]);
    // For multiple post IDs we batch-remove
    for (const postId of postIds) {
      await feedService.removePostFromFeeds(followerIds, postId);
    }
  }

  logger.info('user_deleted — feed cleared', { userId });
}

async function onFollowCreated(event: KafkaEvent): Promise<void> {
  const payload = event.payload as unknown as FollowCreatedPayload;
  const followerId = event.userId;          // who pressed "follow"
  const followingId = payload.followingId;  // who is now followed

  // Add the followed user's recent posts to the follower's feed
  const postIds = await fetchUserRecentPostIds(followingId, 50);

  const nowMs = Date.now();
  for (let i = 0; i < postIds.length; i++) {
    // Give older posts a slightly lower score based on assumed age
    const score = feedService.calculateScore(nowMs - i * 60_000);
    await feedService.addPostToFeed(followerId, postIds[i], score);
  }

  logger.info('follow_created — seeded feed', { followerId, followingId, seedCount: postIds.length });
}

async function onFollowDeleted(event: KafkaEvent): Promise<void> {
  const payload = event.payload as unknown as FollowDeletedPayload;
  const followerId = event.userId;
  const unfollowedId = payload.followingId;

  // Fetch recent posts by the unfollowed user and remove them from the follower's feed
  const postIds = await fetchUserRecentPostIds(unfollowedId, 200);

  if (postIds.length > 0) {
    await feedService.removeFeedEntriesForAuthor(followerId, unfollowedId, postIds);
  }

  logger.info('follow_deleted — cleaned feed', { followerId, unfollowedId });
}
