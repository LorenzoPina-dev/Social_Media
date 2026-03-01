/**
 * HTTP client helpers for calling other microservices.
 * All calls are best-effort — failures are logged but do NOT crash the feed-service.
 *
 * NOTE: Post/user hydration uses Redis-first (StoreService).
 * fetchUserProfilesByIds is the HTTP FALLBACK for cache misses — it fetches
 * user profiles that are not yet in Redis (e.g. users who registered before
 * the denormalization system existed) and lets the caller write them to Redis.
 */

import { config } from '../config';
import { logger } from '../utils/logger';
import type { StoredUser } from './store.service';

export interface FollowerListResponse {
  followerIds: string[];
  followerCount: number;
}

/**
 * Raw user shape returned by user-service GET /api/v1/users/:id
 * and POST /api/v1/users/batch
 */
interface RawUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean;
  bio?: string;
}

/**
 * Fetch the list of follower IDs for a given user from user-service.
 * Used for fan-out on write (post_created) and feed cleanup (post_deleted, follow_deleted).
 */
export async function fetchFollowerIds(authorId: string): Promise<FollowerListResponse> {
  const url = `${config.SERVICES.USER_SERVICE_URL}/api/v1/users/${authorId}/followers/ids`;

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      logger.warn('user-service returned non-OK for followers', { authorId, status: res.status });
      return { followerIds: [], followerCount: 0 };
    }

    const body = (await res.json()) as { data: { followerIds: string[]; total: number } };
    return {
      followerIds: body.data.followerIds ?? [],
      followerCount: body.data.total ?? 0,
    };
  } catch (err) {
    logger.error('Failed to fetch followers from user-service', { authorId, err });
    return { followerIds: [], followerCount: 0 };
  }
}

/**
 * Fetch post IDs authored by a user from post-service.
 * Used for celebrity read-time fan-out, follow seeding, and unfollow cleanup.
 */
export async function fetchUserRecentPostIds(
  userId: string,
  limit = 50,
): Promise<string[]> {
  const url = `${config.SERVICES.POST_SERVICE_URL}/api/v1/users/${userId}/posts/ids?limit=${limit}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];

    const body = (await res.json()) as { data: { postIds: string[] } };
    return body.data.postIds ?? [];
  } catch (err) {
    logger.error('Failed to fetch user post IDs', { userId, err });
    return [];
  }
}

/**
 * Batch-fetch user profiles from user-service.
 * Called ONLY as a Redis cache-miss fallback inside hydrateFeedEntries.
 *
 * Returns a Map<userId, StoredUser> ready to be saved to Redis and used directly.
 * Missing / failed users are silently absent from the map.
 */
export async function fetchUserProfilesByIds(
  userIds: string[],
): Promise<Map<string, StoredUser>> {
  if (userIds.length === 0) return new Map();

  const uniqueIds = [...new Set(userIds)];
  const url = `${config.SERVICES.USER_SERVICE_URL}/api/v1/users/batch`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: uniqueIds }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      logger.warn('user-service batch returned non-OK', { status: res.status, ids: uniqueIds });
      return new Map();
    }

    // user-service wraps response in { success, data: User[] }
    const body = (await res.json()) as { success: boolean; data: RawUser[] };
    const users: RawUser[] = Array.isArray(body.data) ? body.data : [];

    const map = new Map<string, StoredUser>();
    for (const u of users) {
      if (!u.id) continue;
      map.set(u.id, {
        id: u.id,
        username: u.username ?? '',
        displayName: u.display_name ?? u.username ?? '',
        avatarUrl: u.avatar_url ?? '',
        verified: u.verified ? '1' : '0',
        bio: u.bio ?? '',
      });
    }

    logger.debug('fetchUserProfilesByIds: fetched from user-service', {
      requested: uniqueIds.length,
      returned: map.size,
    });

    return map;
  } catch (err) {
    logger.error('Failed to batch-fetch user profiles from user-service', { err });
    return new Map();
  }
}
