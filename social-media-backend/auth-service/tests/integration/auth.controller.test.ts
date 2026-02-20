/**
 * AuthController + MFAController — Integration Tests
 *
 * Approccio: app Express minimale con controller reali
 * e servizi completamente mockati.
 * Testa l'intero layer HTTP (routing → middleware → controller → risposta)
 * senza dipendenze infrastrutturali (DB/Redis/Kafka).
 */

// ── mock prima di qualsiasi import ────────────────────────────────────────
jest.mock('../../src/config/database', () => ({ getDatabase: jest.fn(), connectDatabase: jest.fn() }));
jest.mock('../../src/config/redis',    () => ({ getRedisClient: jest.fn().mockReturnValue({
  get: jest.fn(), set: jest.fn(), setex: jest.fn(), del: jest.fn(),
  ping: jest.fn(), incr: jest.fn().mockResolvedValue(1), expire: jest.fn(), ttl: jest.fn().mockResolvedValue(60),
}) }));
jest.mock('../../src/config/kafka',    () => ({ getKafkaProducer: jest.fn(), connectKafka: jest.fn() }));
jest.mock('../../src/utils/logger',    () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/utils/metrics', () => ({
  metrics: { incrementCounter: jest.fn(), recordRequestDuration: jest.fn() },
}));

jest.mock('../../src/services/auth.service');
jest.mock('../../src/services/mfa.service');

import express, { Application } from 'express';
import request                  from 'supertest';

import { AuthController } from '../../src/controllers/auth.controller';
import { MFAController }  from '../../src/controllers/mfa.controller';
import { AuthService }    from '../../src/services/auth.service';
import { MFAService }     from '../../src/services/mfa.service';

import { setupAuthRoutes } from '../../src/routes/auth.routes';
import { setupMFARoutes }  from '../../src/routes/mfa.routes';
import { errorHandler }    from '../../src/middleware/errorHandler';

import {
  mockUsers, mockDTOs, createMockTokenPair, makeJWT, makeExpiredJWT,
} from '../fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// App factory
// ─────────────────────────────────────────────────────────────────────────────

function buildApp(
  authSvc: jest.Mocked<AuthService>,
  mfaSvc:  jest.Mocked<MFAService>,
): Application {
  const app = express();
  app.use(express.json());

  const authCtrl = new AuthController(authSvc);
  const mfaCtrl  = new MFAController(mfaSvc);

  app.use('/api/v1/auth', setupAuthRoutes(authCtrl));
  app.use('/api/v1/mfa',  setupMFARoutes(mfaCtrl));

  app.use('*', (_, res) => res.status(404).json({ success: false, error: 'Route not found' }));
  app.use(errorHandler);

  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const ALICE    = mockUsers.alice;
const BOB      = mockUsers.bob;          // mfa_enabled: true
const MFA_USER = mockUsers.mfaUser;

const TOKENS       = createMockTokenPair();
const ALICE_TOKEN  = makeJWT(ALICE.id);

// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController (integration)', () => {
  let app: Application;
  let authService: jest.Mocked<AuthService>;
  let mfaService:  jest.Mocked<MFAService>;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(null as any, null as any, null as any, null as any, null as any) as jest.Mocked<AuthService>;
    mfaService  = new MFAService(null as any, null as any, null as any) as jest.Mocked<MFAService>;
    app = buildApp(authService, mfaService);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/auth/register', () => {
    const URL = '/api/v1/auth/register';

    it('201 — crea un nuovo utente e restituisce user + tokens', async () => {
      authService.register.mockResolvedValue({ user: ALICE, tokens: TOKENS });

      const res = await request(app).post(URL).send(mockDTOs.register);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe(ALICE.username);
      expect(res.body.data.tokens.access_token).toBeDefined();
    });

    it('201 — la risposta NON contiene password_hash né mfa_secret', async () => {
      authService.register.mockResolvedValue({ user: ALICE, tokens: TOKENS });

      const res = await request(app).post(URL).send(mockDTOs.register);

      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.user.mfa_secret).toBeUndefined();
    });

    it('400 — username mancante', async () => {
      const { username: _u, ...noUsername } = mockDTOs.register;
      const res = await request(app).post(URL).send(noUsername);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('400 — email non valida', async () => {
      const res = await request(app).post(URL).send({ ...mockDTOs.register, email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('400 — password troppo corta (< 8 caratteri)', async () => {
      const res = await request(app).post(URL).send({ ...mockDTOs.register, password: 'Ab1!' });

      expect(res.status).toBe(400);
    });

    it('400 — username con caratteri non alfanumerici', async () => {
      const res = await request(app).post(URL).send({ ...mockDTOs.register, username: 'user name!' });

      expect(res.status).toBe(400);
    });

    it('400 — username troppo corto (< 3 caratteri)', async () => {
      const res = await request(app).post(URL).send({ ...mockDTOs.register, username: 'ab' });

      expect(res.status).toBe(400);
    });

    it('409 — propaga ConflictError dal service', async () => {
      const { ConflictError } = await import('../../src/types');
      authService.register.mockRejectedValue(new ConflictError('Username already exists'));

      const res = await request(app).post(URL).send(mockDTOs.register);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('429 — rate limiter dopo il limite di richieste', async () => {
      authService.register.mockResolvedValue({ user: ALICE, tokens: TOKENS });

      // Supera il limite di 10 richieste per /register
      const requests = Array.from({ length: 11 }, () =>
        request(app).post(URL).send(mockDTOs.register)
      );
      const responses = await Promise.all(requests);

      const tooMany = responses.filter(r => r.status === 429);
      expect(tooMany.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/auth/login', () => {
    const URL = '/api/v1/auth/login';

    it('200 — login riuscito, restituisce user + tokens', async () => {
      authService.login.mockResolvedValue({ user: ALICE, tokens: TOKENS });

      const res = await request(app).post(URL).send(mockDTOs.login);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.access_token).toBeDefined();
    });

    it('200 — la risposta non espone campi sensibili', async () => {
      authService.login.mockResolvedValue({ user: ALICE, tokens: TOKENS });

      const res = await request(app).post(URL).send(mockDTOs.login);

      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.user.mfa_secret).toBeUndefined();
    });

    it('200 — mfa_required:true se MFA è abilitato e codice non fornito', async () => {
      authService.login.mockResolvedValue({
        user:         BOB,
        tokens:       { access_token: '', refresh_token: '', expires_in: 0 },
        mfa_required: true,
      });

      const res = await request(app).post(URL).send({ username: 'bob', password: 'Secure1!Pass' });

      expect(res.status).toBe(200);
      expect(res.body.data.mfa_required).toBe(true);
    });

    it('200 — login con mfa_code valido', async () => {
      authService.login.mockResolvedValue({ user: MFA_USER, tokens: TOKENS });

      const res = await request(app).post(URL).send(mockDTOs.loginWithMFA);

      expect(res.status).toBe(200);
      expect(res.body.data.tokens.access_token).toBeDefined();
    });

    it('400 — username mancante', async () => {
      const res = await request(app).post(URL).send({ password: 'Pass1!' });

      expect(res.status).toBe(400);
    });

    it('400 — password mancante', async () => {
      const res = await request(app).post(URL).send({ username: 'alice' });

      expect(res.status).toBe(400);
    });

    it('400 — mfa_code con lunghezza sbagliata (non 6 cifre)', async () => {
      const res = await request(app).post(URL).send({ ...mockDTOs.login, mfa_code: '12345' });

      expect(res.status).toBe(400);
    });

    it('401 — propaga UnauthorizedError dal service', async () => {
      const { UnauthorizedError } = await import('../../src/types');
      authService.login.mockRejectedValue(new UnauthorizedError('Invalid credentials'));

      const res = await request(app).post(URL).send(mockDTOs.login);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('401 — account sospeso', async () => {
      const { UnauthorizedError } = await import('../../src/types');
      authService.login.mockRejectedValue(new UnauthorizedError('Account suspended'));

      const res = await request(app).post(URL).send(mockDTOs.login);

      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/auth/refresh', () => {
    const URL = '/api/v1/auth/refresh';
    const BODY = { refresh_token: 'valid.refresh.token' };

    it('200 — restituisce nuova coppia di token', async () => {
      const newTokens = createMockTokenPair();
      authService.refreshToken.mockResolvedValue(newTokens);

      const res = await request(app).post(URL).send(BODY);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.access_token).toBeDefined();
    });

    it('400 — refresh_token mancante nel body', async () => {
      const res = await request(app).post(URL).send({});

      expect(res.status).toBe(400);
    });

    it('401 — token non valido o scaduto', async () => {
      //const { UnauthorizedError } = await import('../../src/types');
      //authService.refreshToken.mockRejectedValue(new UnauthorizedError('Invalid refresh token'));

      const res = await request(app).post(URL).send(BODY);

      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/auth/logout', () => {
    const URL = '/api/v1/auth/logout';
    const BODY = { refresh_token: 'some.refresh.token' };

    it('200 — logout riuscito', async () => {
      authService.logout.mockResolvedValue(undefined);

      const res = await request(app).post(URL).send(BODY);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/logged out/i);
    });

    it('400 — refresh_token mancante nel body', async () => {
      const res = await request(app).post(URL).send({});

      expect(res.status).toBe(400);
    });

    it('chiama authService.logout con il token ricevuto', async () => {
      authService.logout.mockResolvedValue(undefined);

      await request(app).post(URL).send(BODY);

      expect(authService.logout).toHaveBeenCalledWith(BODY.refresh_token);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/auth/logout-all', () => {
    const URL = '/api/v1/auth/logout-all';

    it('200 — logout da tutti i dispositivi per utente autenticato', async () => {
      authService.logoutAll.mockResolvedValue(undefined);

      const res = await request(app)
        .post(URL)
        .set('Authorization', `Bearer ${ALICE_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(authService.logoutAll).toHaveBeenCalledWith(ALICE.id);
    });

    it('401 — senza header Authorization', async () => {
      const res = await request(app).post(URL);

      expect(res.status).toBe(401);
      expect(authService.logoutAll).not.toHaveBeenCalled();
    });

    it('401 — token scaduto', async () => {
      const res = await request(app)
        .post(URL)
        .set('Authorization', `Bearer ${makeExpiredJWT(ALICE.id)}`);

      expect(res.status).toBe(401);
    });

    it('401 — token malformato', async () => {
      const res = await request(app)
        .post(URL)
        .set('Authorization', 'Bearer not.a.valid.jwt');

      expect(res.status).toBe(401);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('MFAController (integration)', () => {
  let app: Application;
  let authService: jest.Mocked<AuthService>;
  let mfaService:  jest.Mocked<MFAService>;
  let authHeader:  string;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(null as any, null as any, null as any, null as any, null as any) as jest.Mocked<AuthService>;
    mfaService  = new MFAService(null as any, null as any, null as any) as jest.Mocked<MFAService>;
    app         = buildApp(authService, mfaService);
    authHeader  = `Bearer ${ALICE_TOKEN}`;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/mfa/setup', () => {
    const URL = '/api/v1/mfa/setup';

    it('200 — restituisce secret, qr_code e backup_codes', async () => {
      mfaService.setupMFA.mockResolvedValue({
        secret:       'BASE32SECRET',
        qr_code:      'data:image/png;base64,QR',
        backup_codes: Array.from({ length: 10 }, (_, i) => `CODE${i}`),
      });

      const res = await request(app).post(URL).set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.secret).toBe('BASE32SECRET');
      expect(res.body.data.qr_code).toBeDefined();
      expect(res.body.data.backup_codes).toHaveLength(10);
    });

    it('401 — senza autenticazione', async () => {
      const res = await request(app).post(URL);
      expect(res.status).toBe(401);
    });

    it('400 — propaga ValidationError se MFA già abilitato', async () => {
      const { ValidationError } = await import('../../src/types');
      mfaService.setupMFA.mockRejectedValue(new ValidationError('MFA already enabled for this user'));

      const res = await request(app).post(URL).set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('chiama mfaService.setupMFA con l\'id dell\'utente autenticato', async () => {
      mfaService.setupMFA.mockResolvedValue({
        secret:       'S',
        qr_code:      'Q',
        backup_codes: [],
      });

      await request(app).post(URL).set('Authorization', authHeader);

      expect(mfaService.setupMFA).toHaveBeenCalledWith(ALICE.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/mfa/verify', () => {
    const URL  = '/api/v1/mfa/verify';
    const BODY = { code: '123456' };

    it('200 — MFA abilitato con successo', async () => {
      mfaService.verifyAndEnableMFA.mockResolvedValue({
        success:      true,
        backup_codes: Array.from({ length: 10 }, (_, i) => `BC${i}`),
      });

      const res = await request(app).post(URL).set('Authorization', authHeader).send(BODY);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.backup_codes).toHaveLength(10);
    });

    it('400 — code mancante', async () => {
      const res = await request(app).post(URL).set('Authorization', authHeader).send({});
      expect(res.status).toBe(400);
    });

    it('400 — code non è 6 cifre', async () => {
      const res = await request(app).post(URL).set('Authorization', authHeader).send({ code: '12345' });
      expect(res.status).toBe(400);
    });

    it('400 — code contiene caratteri non numerici', async () => {
      const res = await request(app).post(URL).set('Authorization', authHeader).send({ code: '12345A' });
      expect(res.status).toBe(400);
    });

    it('401 — senza autenticazione', async () => {
      const res = await request(app).post(URL).send(BODY);
      expect(res.status).toBe(401);
    });

    it('400 — codice TOTP errato', async () => {
      const { ValidationError } = await import('../../src/types');
      mfaService.verifyAndEnableMFA.mockRejectedValue(new ValidationError('Invalid MFA code'));

      const res = await request(app).post(URL).set('Authorization', authHeader).send(BODY);

      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/mfa/disable', () => {
    const URL  = '/api/v1/mfa/disable';
    const BODY = { code: '123456' };

    it('200 — MFA disabilitato con successo', async () => {
      mfaService.disableMFA.mockResolvedValue(undefined);

      const res = await request(app).post(URL).set('Authorization', authHeader).send(BODY);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('401 — senza autenticazione', async () => {
      const res = await request(app).post(URL).send(BODY);
      expect(res.status).toBe(401);
    });

    it('400 — codice errato', async () => {
      const { ValidationError } = await import('../../src/types');
      mfaService.disableMFA.mockRejectedValue(new ValidationError('Invalid MFA code'));

      const res = await request(app).post(URL).set('Authorization', authHeader).send(BODY);

      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/mfa/regenerate-codes', () => {
    const URL  = '/api/v1/mfa/regenerate-codes';
    const BODY = { code: '123456' };

    it('200 — restituisce 10 nuovi backup codes', async () => {
      const newCodes = Array.from({ length: 10 }, (_, i) => `NEW${i}`);
      mfaService.regenerateBackupCodes.mockResolvedValue(newCodes);

      const res = await request(app).post(URL).set('Authorization', authHeader).send(BODY);

      expect(res.status).toBe(200);
      expect(res.body.data.backup_codes).toHaveLength(10);
    });

    it('401 — senza autenticazione', async () => {
      const res = await request(app).post(URL).send(BODY);
      expect(res.status).toBe(401);
    });

    it('400 — codice errato', async () => {
      const { ValidationError } = await import('../../src/types');
      mfaService.regenerateBackupCodes.mockRejectedValue(new ValidationError('Invalid MFA code'));

      const res = await request(app).post(URL).set('Authorization', authHeader).send(BODY);

      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/mfa/status', () => {
    const URL = '/api/v1/mfa/status';

    it('200 — restituisce lo status MFA dell\'utente', async () => {
      mfaService.getMFAStatus.mockResolvedValue({
        enabled:                 true,
        verified:                true,
        backup_codes_remaining:  8,
      });

      const res = await request(app).get(URL).set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.backup_codes_remaining).toBe(8);
    });

    it('200 — MFA non abilitato', async () => {
      mfaService.getMFAStatus.mockResolvedValue({
        enabled:                 false,
        verified:                false,
        backup_codes_remaining:  0,
      });

      const res = await request(app).get(URL).set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.enabled).toBe(false);
    });

    it('401 — senza autenticazione', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });

    it('chiama mfaService.getMFAStatus con l\'id dell\'utente autenticato', async () => {
      mfaService.getMFAStatus.mockResolvedValue({
        enabled: false, verified: false, backup_codes_remaining: 0,
      });

      await request(app).get(URL).set('Authorization', authHeader);

      expect(mfaService.getMFAStatus).toHaveBeenCalledWith(ALICE.id);
    });
  });
});
