/**
 * JWTService – Unit Tests
 *
 * Usa il servizio reale senza mockare jsonwebtoken.
 * I secret vengono da process.env (impostati in setup.ts).
 */

// ── mock delle sole dipendenze infrastrutturali ────────────────────────────
jest.mock('../../src/config/database', () => ({
  getDatabase: jest.fn(),
  connectDatabase: jest.fn(),
}));
jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn(),
  connectRedis: jest.fn(),
}));
jest.mock('../../src/config/kafka', () => ({
  getKafkaProducer: jest.fn(),
  connectKafka: jest.fn(),
}));
jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/utils/metrics', () => ({
  metrics: { incrementCounter: jest.fn(), recordRequestDuration: jest.fn() },
}));

import jwt from 'jsonwebtoken';
import { JWTService }                      from '../../src/services/jwt.service';
import { TokenPayload, UnauthorizedError } from '../../src/types';

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

const BASE_PAYLOAD: TokenPayload = {
  userId:      'user-001',
  username:    'alice',
  email:       'alice@example.com',
  verified:    true,
  mfa_enabled: false,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('JWTService', () => {
  let service: JWTService;

  beforeEach(() => {
    service = new JWTService();
  });

  // ── generateTokenPair ──────────────────────────────────────────────────────
  describe('generateTokenPair', () => {
    it('restituisce access_token, refresh_token ed expires_in', async () => {
      const result = await service.generateTokenPair(BASE_PAYLOAD);

      expect(typeof result.access_token).toBe('string');
      expect(typeof result.refresh_token).toBe('string');
      expect(typeof result.expires_in).toBe('number');
      expect(result.access_token.length).toBeGreaterThan(0);
      expect(result.refresh_token.length).toBeGreaterThan(0);
    });

    it('access_token e refresh_token sono valori distinti', async () => {
      const result = await service.generateTokenPair(BASE_PAYLOAD);
      expect(result.access_token).not.toBe(result.refresh_token);
    });

    it('expires_in corrisponde a 900 secondi (15 m)', async () => {
      const result = await service.generateTokenPair(BASE_PAYLOAD);
      expect(result.expires_in).toBe(900);
    });

    it('incorpora il payload nell\'access_token', async () => {
      const result  = await service.generateTokenPair(BASE_PAYLOAD);
      const decoded = service.decodeToken(result.access_token);

      expect(decoded?.userId).toBe(BASE_PAYLOAD.userId);
      expect(decoded?.username).toBe(BASE_PAYLOAD.username);
      expect(decoded?.email).toBe(BASE_PAYLOAD.email);
      expect(decoded?.verified).toBe(BASE_PAYLOAD.verified);
      expect(decoded?.mfa_enabled).toBe(BASE_PAYLOAD.mfa_enabled);
    });

    it('genera token diversi per payload diversi', async () => {
      const a = await service.generateTokenPair(BASE_PAYLOAD);
      const b = await service.generateTokenPair({ ...BASE_PAYLOAD, userId: 'user-002' });

      expect(a.access_token).not.toBe(b.access_token);
      expect(a.refresh_token).not.toBe(b.refresh_token);
    });
  });

  // ── verifyAccessToken ──────────────────────────────────────────────────────
  describe('verifyAccessToken', () => {
    it('verifica un access_token valido e restituisce il payload', async () => {
      const { access_token } = await service.generateTokenPair(BASE_PAYLOAD);
      const decoded = await service.verifyAccessToken(access_token);

      expect(decoded.userId).toBe(BASE_PAYLOAD.userId);
      expect(decoded.email).toBe(BASE_PAYLOAD.email);
      expect(decoded.iss).toBe('auth-service');
    });

    it('lancia UnauthorizedError per token non valido', async () => {
      await expect(
        service.verifyAccessToken('not.a.valid.token')
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('lancia UnauthorizedError per token manomesso', async () => {
      const { access_token } = await service.generateTokenPair(BASE_PAYLOAD);
      const tampered = access_token.slice(0, -8) + 'TAMPERED';

      await expect(
        service.verifyAccessToken(tampered)
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('lancia UnauthorizedError per token scaduto', async () => {
      const expired = jwt.sign(
        { ...BASE_PAYLOAD },
        ACCESS_SECRET,
        { expiresIn: -1, issuer: 'auth-service' }
      );

      await expect(
        service.verifyAccessToken(expired)
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('lancia UnauthorizedError per stringa vuota', async () => {
      await expect(
        service.verifyAccessToken('')
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rifiuta token firmato col refresh secret', async () => {
      const wrong = jwt.sign(
        { ...BASE_PAYLOAD },
        REFRESH_SECRET,
        { issuer: 'auth-service' }
      );

      await expect(
        service.verifyAccessToken(wrong)
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  // ── verifyRefreshToken ─────────────────────────────────────────────────────
  describe('verifyRefreshToken', () => {
    it('verifica un refresh_token valido', async () => {
      const { refresh_token } = await service.generateTokenPair(BASE_PAYLOAD);
      const decoded = await service.verifyRefreshToken(refresh_token);

      expect(decoded.userId).toBe(BASE_PAYLOAD.userId);
      expect(decoded.username).toBe(BASE_PAYLOAD.username);
    });

    it('lancia UnauthorizedError per token non valido', async () => {
      await expect(
        service.verifyRefreshToken('garbage.token.string')
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rifiuta token firmato col access secret', async () => {
      const wrong = jwt.sign(
        { ...BASE_PAYLOAD },
        ACCESS_SECRET,
        { issuer: 'auth-service' }
      );

      await expect(
        service.verifyRefreshToken(wrong)
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('lancia UnauthorizedError per refresh token scaduto', async () => {
      const expired = jwt.sign(
        { ...BASE_PAYLOAD },
        REFRESH_SECRET,
        { expiresIn: -1, issuer: 'auth-service' }
      );

      await expect(
        service.verifyRefreshToken(expired)
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  // ── decodeToken ────────────────────────────────────────────────────────────
  describe('decodeToken', () => {
    it('decodifica senza verificare firma e restituisce il payload', async () => {
      const { access_token } = await service.generateTokenPair(BASE_PAYLOAD);
      const decoded = service.decodeToken(access_token);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(BASE_PAYLOAD.userId);
      expect(decoded?.iat).toBeDefined();
      expect(decoded?.exp).toBeDefined();
    });

    it('restituisce null per stringa non JWT', () => {
      expect(service.decodeToken('not-a-jwt')).toBeNull();
    });

    it('restituisce null per stringa vuota', () => {
      expect(service.decodeToken('')).toBeNull();
    });

    it('decodifica un token scaduto senza lanciare eccezioni', async () => {
      const expired = jwt.sign(
        { ...BASE_PAYLOAD },
        ACCESS_SECRET,
        { expiresIn: -1, issuer: 'auth-service' }
      );
      const decoded = service.decodeToken(expired);

      expect(decoded?.userId).toBe(BASE_PAYLOAD.userId);
    });
  });
});
