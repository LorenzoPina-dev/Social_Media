/**
 * HTTP client helpers for calling other microservices.
 * All calls are best-effort — failures are logged but do NOT crash the feed-service.
 */

import { config } from '../config';
import { logger } from '../utils/logger';

export interface FollowerListResponse {
  followerIds: string[];
  followerCount: number;
}

/**
 * Fetch the list of follower IDs for a given user from user-service.
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
    return { followerIds: body.data.followerIds, followerCount: body.data.total };
  } catch (err) {
    logger.error('Failed to fetch followers from user-service', { authorId, err });
    return { followerIds: [], followerCount: 0 };
  }
}

/**
 * Fetch post IDs authored by a celebrity user (used in read-time fan-out).
 */
export async function fetchUserRecentPostIds(
  userId: string,
  limit = 50,
): Promise<string[]> {
  const url = `${config.SERVICES.POST_SERVICE_URL}/api/v1/users/${userId}/posts/ids?limit=${limit}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];

    const body = (await res.json()) as { data: { postIds: string[] } };
    return body.data.postIds;
  } catch (err) {
    logger.error('Failed to fetch user post IDs', { userId, err });
    return [];
  }
}
