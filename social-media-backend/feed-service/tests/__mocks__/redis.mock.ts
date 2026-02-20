/**
 * In-memory Redis mock for unit tests.
 * Implements the subset of ioredis API used by feed-service.
 */

type ZSetEntry = { member: string; score: number };

class RedisMock {
  private zsets: Map<string, ZSetEntry[]> = new Map();
  private strings: Map<string, string> = new Map();
  private ttls: Map<string, number> = new Map();
  private pipelines: Array<() => Promise<unknown>> = [];

  // ── ZSET ─────────────────────────────────────────────────────────────────────

  async zadd(key: string, score: number, member: string): Promise<number> {
    const entries = this.zsets.get(key) ?? [];
    const existing = entries.findIndex((e) => e.member === member);
    if (existing !== -1) {
      entries[existing].score = score;
      return 0;
    }
    entries.push({ member, score });
    this.zsets.set(key, entries);
    return 1;
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const entries = this.zsets.get(key);
    if (!entries) return 0;
    const before = entries.length;
    const filtered = entries.filter((e) => !members.includes(e.member));
    this.zsets.set(key, filtered);
    return before - filtered.length;
  }

  async zscore(key: string, member: string): Promise<string | null> {
    const entries = this.zsets.get(key);
    if (!entries) return null;
    const entry = entries.find((e) => e.member === member);
    return entry ? String(entry.score) : null;
  }

  async zincrby(key: string, increment: number, member: string): Promise<string> {
    const entries = this.zsets.get(key) ?? [];
    const existing = entries.find((e) => e.member === member);
    if (existing) {
      existing.score += increment;
      return String(existing.score);
    }
    entries.push({ member, score: increment });
    this.zsets.set(key, entries);
    return String(increment);
  }

  async zcard(key: string): Promise<number> {
    return (this.zsets.get(key) ?? []).length;
  }

  async zremrangebyrank(key: string, start: number, stop: number): Promise<number> {
    const entries = this.zsets.get(key);
    if (!entries) return 0;

    // Sort ascending by score
    const sorted = [...entries].sort((a, b) => a.score - b.score);
    const len = sorted.length;
    const normalizedStop = stop < 0 ? len + stop : stop;
    const toRemove = sorted.slice(start, normalizedStop + 1).map((e) => e.member);

    const filtered = entries.filter((e) => !toRemove.includes(e.member));
    this.zsets.set(key, filtered);
    return toRemove.length;
  }

  async zrevrangebyscore(
    key: string,
    max: string | number,
    min: string | number,
    ...args: string[]
  ): Promise<string[]> {
    const entries = this.zsets.get(key) ?? [];
    const sorted = [...entries].sort((a, b) => b.score - a.score);

    const maxVal = max === '+inf' ? Infinity : parseFloat(String(max));
    const minVal = min === '-inf' ? -Infinity : parseFloat(String(min));

    const filtered = sorted.filter((e) => e.score >= minVal && e.score <= maxVal);

    // Parse LIMIT
    let limited = filtered;
    const limitIdx = args.indexOf('LIMIT');
    if (limitIdx !== -1) {
      const offset = parseInt(args[limitIdx + 1] ?? '0', 10);
      const count = parseInt(args[limitIdx + 2] ?? '100', 10);
      limited = filtered.slice(offset, offset + count);
    }

    const withScores = args.includes('WITHSCORES');
    if (withScores) {
      const result: string[] = [];
      for (const e of limited) {
        result.push(e.member, String(e.score));
      }
      return result;
    }

    return limited.map((e) => e.member);
  }

  // ── General ──────────────────────────────────────────────────────────────────

  async del(key: string): Promise<number> {
    const hadZset = this.zsets.has(key);
    const hadStr = this.strings.has(key);
    this.zsets.delete(key);
    this.strings.delete(key);
    this.ttls.delete(key);
    return hadZset || hadStr ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.ttls.set(key, seconds);
    return 1;
  }

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.strings.set(key, value);
    return 'OK';
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }

  // ── Pipeline (returns self for chaining) ──────────────────────────────────────

  pipeline(): this {
    return this;
  }

  async exec(): Promise<Array<[Error | null, unknown]>> {
    return [];
  }

  // ── Test helpers ─────────────────────────────────────────────────────────────

  /** Reset all state between tests */
  flushAll(): void {
    this.zsets.clear();
    this.strings.clear();
    this.ttls.clear();
  }

  /** Peek at internal ZSET state */
  getZSetEntries(key: string): ZSetEntry[] {
    return (this.zsets.get(key) ?? []).sort((a, b) => b.score - a.score);
  }
}

export const redisMock = new RedisMock();

// Auto-mock module factory
const mockRedis = {
  connectRedis: jest.fn().mockResolvedValue(redisMock),
  getRedisClient: jest.fn().mockReturnValue(redisMock),
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
  redisClient: redisMock,
};

jest.mock('../../src/config/redis', () => mockRedis);

export default mockRedis;
