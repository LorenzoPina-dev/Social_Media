/**
 * JWT Service Unit Tests
 */

import { JWTService } from '../../src/services/jwt.service';
import { TokenPayload } from '../../src/types';

describe('JWTService', () => {
  let jwtService: JWTService;
  const mockPayload: TokenPayload = {
    userId: '123',
    username: 'testuser',
    email: 'test@example.com',
    verified: true,
    mfa_enabled: false,
  };

  beforeEach(() => {
    jwtService = new JWTService();
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', async () => {
      const tokens = await jwtService.generateTokenPair(mockPayload);

      expect(tokens).toHaveProperty('access_token');
      expect(tokens).toHaveProperty('refresh_token');
      expect(tokens).toHaveProperty('expires_in');
      expect(typeof tokens.access_token).toBe('string');
      expect(typeof tokens.refresh_token).toBe('string');
      expect(tokens.access_token).not.toBe(tokens.refresh_token);
    });

    it('should include correct payload in tokens', async () => {
      const tokens = await jwtService.generateTokenPair(mockPayload);
      const decoded = jwtService.decodeToken(tokens.access_token);

      expect(decoded).toMatchObject({
        userId: mockPayload.userId,
        username: mockPayload.username,
        email: mockPayload.email,
        verified: mockPayload.verified,
        mfa_enabled: mockPayload.mfa_enabled,
      });
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const tokens = await jwtService.generateTokenPair(mockPayload);
      const decoded = await jwtService.verifyAccessToken(tokens.access_token);

      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.username).toBe(mockPayload.username);
    });

    it('should throw error for invalid token', async () => {
      await expect(
        jwtService.verifyAccessToken('invalid-token')
      ).rejects.toThrow();
    });

    it('should throw error for expired token', async () => {
      // This would need to use a test token with very short expiry
      // Or mock the jwt.verify function
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      const tokens = await jwtService.generateTokenPair(mockPayload);
      const decoded = await jwtService.verifyRefreshToken(tokens.refresh_token);

      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.username).toBe(mockPayload.username);
    });

    it('should throw error for invalid token', async () => {
      await expect(
        jwtService.verifyRefreshToken('invalid-token')
      ).rejects.toThrow();
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', async () => {
      const tokens = await jwtService.generateTokenPair(mockPayload);
      const decoded = jwtService.decodeToken(tokens.access_token);

      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBe(mockPayload.userId);
    });

    it('should return null for invalid token', () => {
      const decoded = jwtService.decodeToken('invalid-token');
      expect(decoded).toBeNull();
    });
  });
});
