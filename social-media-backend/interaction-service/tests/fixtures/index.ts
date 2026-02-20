/**
 * Test Fixtures — interaction-service
 */

import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { Like, Comment, Share } from '../../src/types';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-must-be-at-least-32chars!';

// ── Mock entity factories ────────────────────────────────────────────────────

export const createMockLike = (overrides: Partial<Like> = {}): Like => ({
  id: uuidv4(),
  user_id: uuidv4(),
  target_id: uuidv4(),
  target_type: 'POST',
  created_at: new Date('2024-01-01'),
  ...overrides,
});

export const createMockComment = (overrides: Partial<Comment> = {}): Comment => ({
  id: uuidv4(),
  post_id: uuidv4(),
  user_id: uuidv4(),
  parent_id: null,
  content: 'This is a test comment',
  like_count: 0,
  depth: 0,
  moderation_status: 'APPROVED',
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  deleted_at: null,
  ...overrides,
});

export const createMockShare = (overrides: Partial<Share> = {}): Share => ({
  id: uuidv4(),
  user_id: uuidv4(),
  post_id: uuidv4(),
  comment: null,
  created_at: new Date('2024-01-01'),
  ...overrides,
});

// ── Known UUIDs for stable tests ─────────────────────────────────────────────

export const TEST_USER_ID    = 'aaa00000-0000-0000-0000-000000000001';
export const TEST_POST_ID    = 'bbb00000-0000-0000-0000-000000000002';
export const TEST_COMMENT_ID = 'ccc00000-0000-0000-0000-000000000003';
export const TEST_SHARE_ID   = 'ddd00000-0000-0000-0000-000000000004';

// ── JWT helpers ───────────────────────────────────────────────────────────────

export function makeJWT(
  userId: string,
  extras: Record<string, unknown> = {},
  options: jwt.SignOptions = {}
): string {
  return jwt.sign(
    { userId, email: `${userId.substring(0, 8)}@test.com`, username: 'testuser', ...extras },
    ACCESS_SECRET,
    { expiresIn: '1h', issuer: 'auth-service', ...options }
  );
}

export function makeExpiredJWT(userId: string): string {
  return makeJWT(userId, {}, { expiresIn: '-1s' });
}

// ── Knex query builder mock ───────────────────────────────────────────────────

export function makeQueryBuilder(resolveValue: unknown = null): Record<string, jest.Mock> {
  const qb: Record<string, jest.Mock> = {
    where:      jest.fn(),
    whereNull:  jest.fn(),
    whereIn:    jest.fn(),
    orWhere:    jest.fn(),
    andWhere:   jest.fn(),
    first:      jest.fn().mockResolvedValue(resolveValue),
    insert:     jest.fn().mockReturnThis(),
    update:     jest.fn().mockReturnThis(),
    delete:     jest.fn().mockResolvedValue(1),
    returning:  jest.fn().mockResolvedValue(
      Array.isArray(resolveValue) ? resolveValue : resolveValue ? [resolveValue] : []
    ),
    count:      jest.fn(),
    orderBy:    jest.fn(),
    limit:      jest.fn(),
    offset:     jest.fn(),
    select:     jest.fn().mockResolvedValue(Array.isArray(resolveValue) ? resolveValue : []),
    join:       jest.fn(),
    increment:  jest.fn().mockResolvedValue(1),
    decrement:  jest.fn().mockResolvedValue(1),
    keys:       jest.fn().mockResolvedValue([]),
    raw:        jest.fn().mockResolvedValue([]),
  };

  const chainable: (keyof typeof qb)[] = [
    'where', 'whereNull', 'whereIn', 'orWhere', 'andWhere',
    'orderBy', 'limit', 'join',
  ];
  for (const method of chainable) qb[method].mockReturnValue(qb);

  qb.count.mockReturnValue({ ...qb, first: jest.fn().mockResolvedValue({ count: '0' }) });
  qb.select.mockReturnValue(qb);

  return qb;
}
