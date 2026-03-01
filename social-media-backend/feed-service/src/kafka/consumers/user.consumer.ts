/**
 * User Events Consumer
 *
 * Responsibilities:
 *  - user_created    → persist user profile in Redis for feed hydration
 *  - user_updated    → update user profile in Redis
 *  - user_deleted    → delete user's own feed + remove their posts from follower feeds
 *                      + delete user profile from Redis
 *  - follow_created  → seed follower's feed with the followed user's recent posts
 *  - follow_deleted  → remove unfollowed user's posts from the follower's feed
 */

import { feedService } from '../../services/feed.service';
import { storeService } from '../../services/store.service';
import { fetchFollowerIds, fetchUserRecentPostIds } from '../../services/http.service';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import type {
  KafkaEvent,
  FollowCreatedPayload,
  FollowDeletedPayload,
  UserCreatedPayload,
  UserUpdatedPayload,
} from '../../types';

export async function handleUserEvent(event: KafkaEvent): Promise<void> {
  const label = { topic: 'user_events', event_type: event.type };

  try {
    switch (event.type) {
      case 'user_created':
        await onUserCreated(event);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
        break;

      case 'user_updated':
        await onUserUpdated(event);
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'success' });
        break;

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

      default:
        // user_updated events like message_sent, data_exported, etc. are irrelevant here
        metrics.incrementCounter('kafka_message_processed', { ...label, status: 'skipped' });
        break;
    }
  } catch (err) {
    logger.error('Error handling user event', { event, err });
    metrics.incrementCounter('kafka_message_processed', { ...label, status: 'error' });
  }
}

async function onUserCreated(event: KafkaEvent): Promise<void> {
  // The event is published flat (not nested in payload) by UserProducer
  const data = event as unknown as UserCreatedPayload & { userId: string };
  const userId = data.userId ?? event.entityId ?? event.userId;

  await storeService.saveUserProfile({
    id: userId,
    username: data.username ?? '',
    displayName: data.display_name ?? data.username ?? '',
    avatarUrl: data.avatar_url ?? null,
    verified: data.verified ?? false,
  });

  logger.info('user_created — profile cached', { userId });
}

async function onUserUpdated(event: KafkaEvent): Promise<void> {
  // UserProducer publishes user_updated flat (not in payload)
  const data = event as unknown as UserUpdatedPayload & { userId: string };
  const userId = data.userId ?? event.entityId ?? event.userId;

  await storeService.saveUserProfile({
    id: userId,
    username: data.username ?? '',
    displayName: data.display_name ?? '',
    avatarUrl: data.avatar_url ?? null,
    verified: data.verified ?? false,
    bio: data.bio,
  });

  logger.info('user_updated — profile refreshed in cache', { userId });
}

async function onUserDeleted(event: KafkaEvent): Promise<void> {
  const userId = event.entityId;

  // Clear the deleted user's own feed
  await feedService.clearFeed(userId);

  // Remove their posts from all follower feeds
  const postIds = await fetchUserRecentPostIds(userId, 1000);
  const { followerIds } = await fetchFollowerIds(userId);

  if (postIds.length > 0 && followerIds.length > 0) {
    for (const postId of postIds) {
      await feedService.removePostFromFeeds(followerIds, postId);
    }
  }

  // Remove the user's profile from the denormalized store
  await storeService.deleteUserProfile(userId);

  logger.info('user_deleted — feed and profile cleared', { userId });
}

async function onFollowCreated(event: KafkaEvent): Promise<void> {
  const payload = event.payload as unknown as FollowCreatedPayload;
  const followerId = event.userId;          // who pressed "follow"
  const followingId = payload.followingId;  // who is now followed

  // Add the followed user's recent posts to the follower's feed
  const postIds = await fetchUserRecentPostIds(followingId, 50);

  const nowMs = Date.now();
  for (let i = 0; i < postIds.length; i++) {
    const score = feedService.calculateScore(nowMs - i * 60_000);
    await feedService.addPostToFeed(followerId, postIds[i], score);
  }

  logger.info('follow_created — seeded feed', { followerId, followingId, seedCount: postIds.length });
}

async function onFollowDeleted(event: KafkaEvent): Promise<void> {
  const payload = event.payload as unknown as FollowDeletedPayload;
  const followerId = event.userId;
  const unfollowedId = payload.followingId;

  const postIds = await fetchUserRecentPostIds(unfollowedId, 200);

  if (postIds.length > 0) {
    await feedService.removeFeedEntriesForAuthor(followerId, unfollowedId, postIds);
  }

  logger.info('follow_deleted — cleaned feed', { followerId, unfollowedId });
}
