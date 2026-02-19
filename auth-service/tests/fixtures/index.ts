/**
 * Test Fixtures
 * Reusable test data for auth service tests
 */

import { v4 as uuidv4 } from 'uuid';
import { User, Session, MFASecret, TokenPair, DecodedToken } from '../../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// Factory helpers
// ─────────────────────────────────────────────────────────────────────────────

export const createMockUser = (overrides?: Partial<User>): User => {
  const id = uuidv4();
  return {
    id,
    username:      `user_${id.substring(0, 8)}`,
    email:         `${id.substring(0, 8)}@test.com`,
    password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakesalt$fakehash',
    display_name:  'Test User',
    verified:      false,
    mfa_enabled:   false,
    status:        'ACTIVE',
    created_at:    new Date('2024-01-01'),
    updated_at:    new Date('2024-01-01'),
    ...overrides,
  };
};

export const createMockSession = (userId: string, overrides?: Partial<Session>): Session => ({
  id:            uuidv4(),
  user_id:       userId,
  refresh_token: `refresh.${uuidv4()}`,
  device_info:   'Mozilla/5.0 (Test Browser)',
  ip_address:    '127.0.0.1',
  expires_at:    new Date(Date.now() + 30 * 24 * 3600 * 1000),
  created_at:    new Date(),
  last_activity: new Date(),
  ...overrides,
});

export const createMockMFASecret = (userId: string, overrides?: Partial<MFASecret>): MFASecret => ({
  id:           uuidv4(),
  user_id:      userId,
  secret:       'BASE32TESTSECRET',
  backup_codes: Array.from({ length: 10 }, (_, i) => `BACKUP${i.toString().padStart(2, '0')}`),
  created_at:   new Date(),
  ...overrides,
});

export const createMockTokenPair = (overrides?: Partial<TokenPair>): TokenPair => ({
  access_token:  `eyJ.mock.access.${uuidv4()}`,
  refresh_token: `eyJ.mock.refresh.${uuidv4()}`,
  expires_in:    900,
  ...overrides,
});

export const createMockDecodedToken = (userId: string, overrides?: Partial<DecodedToken>): DecodedToken => ({
  userId,
  username:    `user_${userId.substring(0, 8)}`,
  email:       `${userId.substring(0, 8)}@test.com`,
  verified:    true,
  mfa_enabled: false,
  iat:         Math.floor(Date.now() / 1000),
  exp:         Math.floor(Date.now() / 1000) + 900,
  iss:         'auth-service',
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// Preset mock users
// ─────────────────────────────────────────────────────────────────────────────

export const mockUsers = {
  alice: createMockUser({
    id:           'alice-uuid-0001',
    username:     'alice',
    email:        'alice@example.com',
    display_name: 'Alice Wonderland',
    verified:     true,
    mfa_enabled:  false,
    status:       'ACTIVE',
  }),

  bob: createMockUser({
    id:           'bob-uuid-0002',
    username:     'bob',
    email:        'bob@example.com',
    display_name: 'Bob Builder',
    verified:     true,
    mfa_enabled:  true,
    mfa_secret:   'BOB_MFA_SECRET_BASE32',
    status:       'ACTIVE',
  }),

  suspended: createMockUser({
    id:           'susp-uuid-0003',
    username:     'suspended_user',
    email:        'suspended@example.com',
    display_name: 'Suspended User',
    verified:     true,
    status:       'SUSPENDED',
  }),

  unverified: createMockUser({
    id:           'unvr-uuid-0004',
    username:     'unverified_user',
    email:        'unverified@example.com',
    display_name: 'Unverified User',
    verified:     false,
    status:       'ACTIVE',
  }),

  mfaUser: createMockUser({
    id:           'mfa-uuid-0005',
    username:     'mfa_user',
    email:        'mfa@example.com',
    display_name: 'MFA User',
    verified:     true,
    mfa_enabled:  true,
    mfa_secret:   'MFA_USER_SECRET_BASE32',
    status:       'ACTIVE',
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Preset mock DTOs
// ─────────────────────────────────────────────────────────────────────────────

export const mockDTOs = {
  register: {
    username:     'newuser',
    email:        'newuser@example.com',
    password:     'Secure1!Password',
    display_name: 'New User',
  },
  login: {
    username: 'alice',
    password: 'Secure1!Password',
  },
  loginWithMFA: {
    username: 'mfa_user',
    password: 'Secure1!Password',
    mfa_code: '123456',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Knex query builder mock helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a minimal Knex query builder stub.
 * resolveValue is what `.first()` / `.returning()` / etc. resolve to.
 */
export function makeQueryBuilder(resolveValue: unknown = null): Record<string, jest.Mock> {
  const qb: Record<string, jest.Mock> = {
    where:       jest.fn(),
    whereNull:   jest.fn(),
    whereIn:     jest.fn(),
    orWhere:     jest.fn(),
    andWhere:    jest.fn(),
    first:       jest.fn().mockResolvedValue(resolveValue),
    insert:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    delete:      jest.fn().mockResolvedValue(1),
    returning:   jest.fn().mockResolvedValue(
      Array.isArray(resolveValue) ? resolveValue : resolveValue ? [resolveValue] : []
    ),
    count:       jest.fn(),
    orderBy:     jest.fn(),
    limit:       jest.fn(),
    offset:      jest.fn(),
    select:      jest.fn(),
    increment:   jest.fn().mockResolvedValue(1),
    decrement:   jest.fn().mockResolvedValue(1),
  };

  // All chainable methods return the same qb
  const chainable: (keyof typeof qb)[] = [
    'where', 'whereNull', 'whereIn', 'orWhere', 'andWhere',
    'orderBy', 'limit', 'select',
  ];
  for (const method of chainable) {
    qb[method].mockReturnValue(qb);
  }

  // count().first() returns a count result
  qb.count.mockReturnValue({
    ...qb,
    first: jest.fn().mockResolvedValue({ count: '0' }),
  });

  return qb;
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT helpers for integration / e2e tests
// ─────────────────────────────────────────────────────────────────────────────

import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-must-be-at-least-32!';

export function makeJWT(
  userId: string,
  extras: Record<string, unknown> = {},
  options: jwt.SignOptions = {}
): string {
  return jwt.sign(
    {
      userId,
      username:    `user_${userId.substring(0, 4)}`,
      email:       `${userId.substring(0, 4)}@test.com`,
      verified:    true,
      mfa_enabled: false,
      ...extras,
    },
    ACCESS_SECRET,
    { expiresIn: '1h', issuer: 'auth-service', ...options }
  );
}

export function makeExpiredJWT(userId: string): string {
  return makeJWT(userId, {}, { expiresIn: '-1s' });
}
