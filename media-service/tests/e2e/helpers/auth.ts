/**
 * E2E Auth Helper — media-service
 *
 * Generates real JWT tokens signed with the test secret,
 * matching the structure expected by requireAuth middleware.
 */

import jwt from 'jsonwebtoken';

const TEST_SECRET = process.env.JWT_ACCESS_SECRET ?? 'e2e-test-secret-key';

export const TEST_USER_ID = 'e2e-user-00000000-0000-0000-0000-000000000001';
export const TEST_USER_2_ID = 'e2e-user-00000000-0000-0000-0000-000000000002';

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  verified: boolean;
  mfa_enabled: boolean;
  jti: string;
}

export function makeAuthToken(overrides: Partial<TokenPayload> = {}): string {
  const payload: TokenPayload = {
    userId: TEST_USER_ID,
    username: 'e2euser',
    email: 'e2e@test.local',
    verified: true,
    mfa_enabled: false,
    jti: `jti-${Date.now()}`,
    ...overrides,
  };
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

export function makeExpiredToken(): string {
  return jwt.sign(
    { userId: TEST_USER_ID, username: 'e2euser', email: 'e2e@test.local', verified: true, mfa_enabled: false, jti: 'expired-jti' },
    TEST_SECRET,
    { expiresIn: '-1s' }
  );
}

export function bearerHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
