/**
 * UserService HTTP Client
 *
 * Fetches public user profiles from user-service to hydrate comments.
 * Uses a simple in-process LRU cache (TTL 60s) to avoid redundant calls.
 */

import { logger } from '../utils/logger';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3002';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  verified: boolean;
}

// ── Simple TTL cache ──────────────────────────────────────────────────────────
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { profile: UserProfile; expiresAt: number }>();

function cacheGet(id: string): UserProfile | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(id); return null; }
  return entry.profile;
}

function cacheSet(profile: UserProfile): void {
  if (cache.size > 2000) {
    // evict oldest entry
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(profile.id, { profile, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Batch fetch ───────────────────────────────────────────────────────────────

/**
 * Fetch multiple user profiles in a single HTTP call.
 * Falls back to a per-user fallback object if the service is unreachable.
 */
export async function fetchUserProfiles(
  userIds: string[]
): Promise<Map<string, UserProfile>> {
  const result = new Map<string, UserProfile>();
  if (userIds.length === 0) return result;

  // Return cached profiles immediately
  const missing: string[] = [];
  for (const id of userIds) {
    const cached = cacheGet(id);
    if (cached) {
      result.set(id, cached);
    } else {
      missing.push(id);
    }
  }

  if (missing.length === 0) return result;

  try {
    const response = await fetch(`${USER_SERVICE_URL}/api/v1/users/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: missing }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`user-service responded ${response.status}`);
    }

    const json = await response.json() as any;

    // Handle both { data: [...] } envelope and plain array
    const profiles: UserProfile[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.data) ? json.data : [];

    for (const profile of profiles) {
      if (profile?.id) {
        cacheSet(profile);
        result.set(profile.id, profile);
      }
    }
  } catch (err) {
    logger.warn('Failed to fetch user profiles from user-service', {
      error: err instanceof Error ? err.message : String(err),
      userIds: missing,
    });
  }

  // Fallback for any ID that still didn't resolve
  for (const id of missing) {
    if (!result.has(id)) {
      result.set(id, {
        id,
        username: 'utente',
        display_name: null,
        avatar_url: null,
        verified: false,
      });
    }
  }

  return result;
}
