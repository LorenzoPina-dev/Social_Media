/**
 * UserServiceClient — HTTP client per recuperare i following IDs dal user-service.
 *
 * Strategia di caching a due livelli:
 *  - L1: Map in-process (TTL 60s, max 500 entries) — evita round-trip Redis
 *  - L2: Redis  (TTL 5 min) — evita chiamate HTTP cross-service
 *
 * In caso di errore (user-service down o Redis down) restituisce un array
 * vuoto invece di far crashare il feed — fail-open per garantire disponibilità.
 */

import { CacheService } from './cache.service';
import { logger } from '../utils/logger';

// ─── L1 in-process cache ─────────────────────────────────────────────────────
const l1Cache = new Map<string, { ids: string[]; expiresAt: number }>();
const L1_TTL_MS = 60_000;       // 60 s
const L1_MAX    = 500;

function l1Get(userId: string): string[] | null {
  const entry = l1Cache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { l1Cache.delete(userId); return null; }
  return entry.ids;
}

function l1Set(userId: string, ids: string[]): void {
  if (l1Cache.size >= L1_MAX) {
    const firstKey = l1Cache.keys().next().value;
    if (firstKey !== undefined) l1Cache.delete(firstKey);
  }
  l1Cache.set(userId, { ids, expiresAt: Date.now() + L1_TTL_MS });
}

export function l1DeleteFollowing(userId: string): void {
  l1Cache.delete(userId);
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class UserServiceClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private cacheService: CacheService,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Ritorna la lista degli ID degli utenti che `userId` segue.
   * Ordine: non garantito (solo IDs, non oggetti utente completi).
   *
   * Strategia: L1 → L2 (Redis) → HTTP
   */
  async getFollowingIds(userId: string): Promise<string[]> {
    const cacheKey = `following_ids:${userId}`;

    // ── L1 ──────────────────────────────────────────────────────────────────
    const fromL1 = l1Get(userId);
    if (fromL1 !== null) return fromL1;

    // ── L2 (Redis) ──────────────────────────────────────────────────────────
    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        const ids = JSON.parse(cached) as string[];
        l1Set(userId, ids);
        return ids;
      }
    } catch {
      // Redis failure — vai diretto all'HTTP
    }

    // ── HTTP (user-service) ──────────────────────────────────────────────────
    try {
      // Recupera fino a 2000 following in una singola chiamata (praticamente
      // illimitato per uso normale; aumenta se necessario).
      const url = `${this.baseUrl}/api/v1/users/${userId}/following?limit=2000&offset=0`;
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000), // 3 s timeout
      });

      if (!response.ok) {
        logger.warn('UserServiceClient: non-OK response', {
          status: response.status,
          userId,
          url,
        });
        return [];
      }

      // Envelope: { success: true, data: { items: User[], pagination: {...} } }
      const json = (await response.json()) as {
        success: boolean;
        data: { items: Array<{ id: string }> };
      };

      const ids = (json?.data?.items ?? []).map((u) => u.id).filter(Boolean);

      // Salva in L2 (5 min) e L1
      try {
        await this.cacheService.set(cacheKey, JSON.stringify(ids), 300);
      } catch {
        // Non bloccare se Redis non risponde
      }
      l1Set(userId, ids);

      logger.debug('UserServiceClient: following IDs fetched', {
        userId,
        count: ids.length,
      });
      return ids;
    } catch (error) {
      logger.error('UserServiceClient: failed to fetch following IDs — returning []', {
        error,
        userId,
      });
      return [];
    }
  }

  /**
   * Invalida le cache dei following IDs per un utente.
   * Da chiamare quando il grafo di follow cambia (es. via Kafka).
   */
  async invalidateFollowingIds(userId: string): Promise<void> {
    l1DeleteFollowing(userId);
    try {
      await this.cacheService.del(`following_ids:${userId}`);
    } catch {
      // ignore
    }
  }
}
