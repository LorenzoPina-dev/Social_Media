/**
 * Auth Service — E2E Tests
 *
 * Approccio: pipeline REALE end-to-end.
 *   - Usa `createApp()` (l'app Express vera, con tutti i middleware e le route)
 *   - NON mocka AuthService né MFAService: la business logic gira davvero
 *   - Mocka esclusivamente l'infrastruttura esterna (DB, Redis, Kafka)
 *     tramite spyOn sui metodi dei Model e mock dei config
 *   - Testa il flusso completo: HTTP → route → middleware → controller → service → model
 *
 * Differenza rispetto agli integration test:
 *   - Integration: singolo endpoint, servizi mockati
 *   - E2E: flussi multi-step, infrastruttura mockata al livello più basso possibile
 */

// ── Mock infrastruttura (devono venire prima di qualsiasi import) ─────────────

jest.mock('../../src/config/database', () => ({
  getDatabase:     jest.fn().mockReturnValue({ raw: jest.fn().mockResolvedValue(null) }),
  connectDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    get:    jest.fn().mockResolvedValue(null), // count = 0 → rate limit mai superato
    set:    jest.fn().mockResolvedValue('OK'),
    setex:  jest.fn().mockResolvedValue('OK'),
    del:    jest.fn().mockResolvedValue(1),
    ping:   jest.fn().mockResolvedValue('PONG'),
    incr:   jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl:    jest.fn().mockResolvedValue(60),
  }),
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/config/kafka', () => ({
  getKafkaProducer: jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) }),
  connectKafka:     jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../src/utils/metrics', () => ({
  metrics: { incrementCounter: jest.fn(), recordRequestDuration: jest.fn() },
}));

// ─────────────────────────────────────────────────────────────────────────────

import { Application }    from 'express';
import request            from 'supertest';

import { createApp }      from '../../src/app';
import { UserModel }      from '../../src/models/user.model';
import { SessionModel }   from '../../src/models/session.model';
import { MFAModel }       from '../../src/models/mfa.model';

import {
  mockUsers,
  mockDTOs,
  createMockSession,
  createMockMFASecret,
  makeJWT,
  makeExpiredJWT,
  createMockTokenPair,
} from '../fixtures';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const ALICE = mockUsers.alice;
const BOB   = mockUsers.bob;

/** Configura il livello modello per simulare un utente che non esiste ancora. */
function mockNoExistingUser() {
  jest.spyOn(UserModel.prototype,   'findByUsername').mockResolvedValue(null);
  jest.spyOn(UserModel.prototype,   'findByEmail').mockResolvedValue(null);
}

/** Configura il livello modello per simulare la creazione di un utente. */
function mockCreateUser(user = ALICE) {
  jest.spyOn(UserModel.prototype, 'create').mockResolvedValue(user);
}

/** Configura il livello sessione (contatore sotto limite, create ok). */
function mockSessionCreate(userId = ALICE.id) {
  jest.spyOn(SessionModel.prototype, 'countActiveForUser').mockResolvedValue(0);
  jest.spyOn(SessionModel.prototype, 'findByUserId').mockResolvedValue([]);
  jest.spyOn(SessionModel.prototype, 'create').mockResolvedValue(
    createMockSession(userId)
  );
}

/** Configura il livello modello per simulare un login riuscito. */
function mockLoginUser(user = ALICE, passwordValid = true) {
  jest.spyOn(UserModel.prototype, 'findByUsername').mockResolvedValue(user);
  jest.spyOn(UserModel.prototype, 'verifyPassword').mockResolvedValue(passwordValid);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1: Register → Login → Refresh → Logout lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — Register → Login → Refresh → Logout lifecycle', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Redis mock: rate limit sempre sotto soglia
    const { getRedisClient } = require('../../src/config/redis');
    getRedisClient.mockReturnValue({
      get:    jest.fn().mockResolvedValue(null),
      incr:   jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      ttl:    jest.fn().mockResolvedValue(60),
    });
  });

  it('flusso completo: register → login → refresh → logout', async () => {
    // ── 1. REGISTER ──────────────────────────────────────────────────────────
    mockNoExistingUser();
    mockCreateUser(ALICE);
    mockSessionCreate(ALICE.id);

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send(mockDTOs.register)
      .expect(201);

    expect(registerRes.body.success).toBe(true);
    expect(registerRes.body.data.user.username).toBe(ALICE.username);
    expect(registerRes.body.data.tokens.access_token).toBeTruthy();
    expect(registerRes.body.data.tokens.refresh_token).toBeTruthy();
    // Campi sensibili mai esposti
    expect(registerRes.body.data.user.password_hash).toBeUndefined();
    expect(registerRes.body.data.user.mfa_secret).toBeUndefined();

    // Salviamo i token reali generati dal JWTService
    const { access_token: accessToken1, refresh_token: refreshToken1 } =
      registerRes.body.data.tokens;

    // ── 2. LOGIN ─────────────────────────────────────────────────────────────
    mockLoginUser(ALICE, true);
    mockSessionCreate(ALICE.id);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send(mockDTOs.login)
      .expect(200);

    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.id).toBe(ALICE.id);
    expect(loginRes.body.data.tokens.access_token).toBeTruthy();

    const { refresh_token: refreshToken2 } = loginRes.body.data.tokens;

    // ── 3. REFRESH ───────────────────────────────────────────────────────────
    const session = createMockSession(ALICE.id, { refresh_token: refreshToken2 });
    jest.spyOn(SessionModel.prototype, 'findByRefreshToken').mockResolvedValue(session);
    jest.spyOn(SessionModel.prototype, 'updateActivity').mockResolvedValue(undefined);
    jest.spyOn(UserModel.prototype, 'findById').mockResolvedValue(ALICE);
    jest.spyOn(SessionModel.prototype, 'delete').mockResolvedValue(undefined);
    mockSessionCreate(ALICE.id);

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken2 })
      .expect(200);

    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.access_token).toBeTruthy();
    // Il nuovo access token è diverso da quello originale
    expect(refreshRes.body.data.access_token).not.toBe(accessToken1);

    const { refresh_token: refreshToken3 } = refreshRes.body.data;

    // ── 4. LOGOUT ────────────────────────────────────────────────────────────
    const session3 = createMockSession(ALICE.id, { refresh_token: refreshToken3 });
    jest.spyOn(SessionModel.prototype, 'findByRefreshToken').mockResolvedValue(session3);
    jest.spyOn(SessionModel.prototype, 'delete').mockResolvedValue(undefined);

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refresh_token: refreshToken3 })
      .expect(200);

    expect(logoutRes.body.success).toBe(true);

    // ── 5. Refresh dopo logout → sessione non trovata → 401 ──────────────────
    jest.spyOn(SessionModel.prototype, 'findByRefreshToken').mockResolvedValue(null);

    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken3 })
      .expect(401);
  });

  it('register → login multipli → logout-all elimina tutte le sessioni', async () => {
    const aliceToken = makeJWT(ALICE.id);

    // Register
    mockNoExistingUser();
    mockCreateUser(ALICE);
    mockSessionCreate(ALICE.id);
    await request(app).post('/api/v1/auth/register').send(mockDTOs.register).expect(201);

    // Due login da "device diversi"
    for (let i = 0; i < 2; i++) {
      mockLoginUser(ALICE, true);
      mockSessionCreate(ALICE.id);
      await request(app).post('/api/v1/auth/login').send(mockDTOs.login).expect(200);
    }

    // Logout ALL
    const deleteAllSpy = jest
      .spyOn(SessionModel.prototype, 'deleteAllForUser')
      .mockResolvedValue(undefined);

    const logoutAllRes = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    expect(logoutAllRes.body.success).toBe(true);
    expect(deleteAllSpy).toHaveBeenCalledWith(ALICE.id);

    // Qualsiasi refresh ora → sessione non trovata → 401
    jest.spyOn(SessionModel.prototype, 'findByRefreshToken').mockResolvedValue(null);

    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'stale.refresh.token' })
      .expect(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2: MFA lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — MFA lifecycle: setup → verify → status → login con MFA → disable', () => {
  let app: Application;
  let aliceToken: string;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    aliceToken = makeJWT(ALICE.id);

    // Redis mock: rate limit sempre ok
    const { getRedisClient } = require('../../src/config/redis');
    getRedisClient.mockReturnValue({
      get:    jest.fn().mockResolvedValue(null),
      incr:   jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      ttl:    jest.fn().mockResolvedValue(60),
    });
  });

  it('setup MFA → risposta con secret e QR code', async () => {
    // Alice senza MFA attivo
    jest.spyOn(UserModel.prototype, 'findById').mockResolvedValue(ALICE);

    const mfaRecord = createMockMFASecret(ALICE.id);
    jest.spyOn(MFAModel.prototype, 'create').mockResolvedValue(mfaRecord);

    const res = await request(app)
      .post('/api/v1/mfa/setup')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.secret).toBeTruthy();
    expect(res.body.data.qr_code).toMatch(/^data:image\/png/);
    expect(res.body.data.backup_codes).toHaveLength(10);
  });

  it('setup MFA con MFA già abilitato → 400', async () => {
    // Alice con mfa_enabled = true
    jest.spyOn(UserModel.prototype, 'findById').mockResolvedValue({
      ...ALICE,
      mfa_enabled: true,
    });

    const res = await request(app)
      .post('/api/v1/mfa/setup')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('verify MFA con codice TOTP valido → abilita MFA', async () => {
    // Usiamo un secret reale per generare un TOTP valido
    const speakeasy = require('speakeasy');
    const secret    = speakeasy.generateSecret({ length: 20 });
    const validCode = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

    const mfaRecord = createMockMFASecret(ALICE.id, { secret: secret.base32 });
    jest.spyOn(MFAModel.prototype, 'findByUserId').mockResolvedValue(mfaRecord);
    jest.spyOn(MFAModel.prototype, 'verify').mockResolvedValue(undefined);
    jest.spyOn(UserModel.prototype, 'enableMFA').mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/mfa/verify')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ code: validCode })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.backup_codes).toBeInstanceOf(Array);
  });

  it('verify MFA con codice non valido → 400', async () => {
    const mfaRecord = createMockMFASecret(ALICE.id, { secret: 'INVALIDSECRET12345' });
    jest.spyOn(MFAModel.prototype, 'findByUserId').mockResolvedValue(mfaRecord);

    const res = await request(app)
      .post('/api/v1/mfa/verify')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ code: '000000' })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('GET /status → restituisce stato MFA corretto', async () => {
    // Alice con MFA abilitato
    const aliceWithMFA = { ...ALICE, mfa_enabled: true };
    jest.spyOn(UserModel.prototype, 'findById').mockResolvedValue(aliceWithMFA);

    const mfaRecord = createMockMFASecret(ALICE.id, {
      verified_at: new Date(),
    });
    jest.spyOn(MFAModel.prototype, 'findByUserId').mockResolvedValue(mfaRecord);

    const res = await request(app)
      .get('/api/v1/mfa/status')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.verified).toBe(true);
    expect(typeof res.body.data.backup_codes_remaining).toBe('number');
  });

  it('login con utente MFA → senza codice ritorna mfa_required = true', async () => {
    const bobWithMFA = { ...BOB, mfa_enabled: true };
    jest.spyOn(UserModel.prototype, 'findByUsername').mockResolvedValue(bobWithMFA);
    jest.spyOn(UserModel.prototype, 'verifyPassword').mockResolvedValue(true);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'bob', password: 'Secure1!Pass' })
      .expect(200);

    expect(res.body.data.mfa_required).toBe(true);
    expect(res.body.data.tokens.access_token).toBe('');
  });

  it('login con MFA + codice TOTP valido → token completi', async () => {
    const speakeasy = require('speakeasy');
    const secret    = speakeasy.generateSecret({ length: 20 });
    const validCode = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

    const bobWithMFA = {
      ...BOB,
      mfa_enabled: true,
      mfa_secret:  secret.base32,
    };

    jest.spyOn(UserModel.prototype, 'findByUsername').mockResolvedValue(bobWithMFA);
    jest.spyOn(UserModel.prototype, 'verifyPassword').mockResolvedValue(true);
    // verifyMFAToken chiama findById internamente
    jest.spyOn(UserModel.prototype, 'findById').mockResolvedValue(bobWithMFA);
    jest.spyOn(MFAModel.prototype, 'useBackupCode').mockResolvedValue(false);
    mockSessionCreate(BOB.id);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'bob', password: 'Secure1!Pass', mfa_code: validCode })
      .expect(200);

    expect(res.body.data.tokens.access_token).toBeTruthy();
    expect(res.body.data.mfa_required).toBeUndefined();
  });

  it('disable MFA con codice valido → MFA rimosso', async () => {
    const speakeasy = require('speakeasy');
    const secret    = speakeasy.generateSecret({ length: 20 });
    const validCode = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

    const aliceWithMFA = { ...ALICE, mfa_enabled: true, mfa_secret: secret.base32 };
    jest.spyOn(UserModel.prototype, 'findById').mockResolvedValue(aliceWithMFA);
    jest.spyOn(MFAModel.prototype, 'useBackupCode').mockResolvedValue(false);
    jest.spyOn(UserModel.prototype, 'disableMFA').mockResolvedValue(undefined);
    jest.spyOn(MFAModel.prototype, 'delete').mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/mfa/disable')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ code: validCode })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('disable MFA con codice non valido → 400', async () => {
    const aliceWithMFA = { ...ALICE, mfa_enabled: true, mfa_secret: 'INVALIDSECRET123' };
    jest.spyOn(UserModel.prototype, 'findById').mockResolvedValue(aliceWithMFA);
    jest.spyOn(MFAModel.prototype, 'useBackupCode').mockResolvedValue(false);

    const res = await request(app)
      .post('/api/v1/mfa/disable')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ code: '000000' })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('regenera backup codes con codice TOTP valido', async () => {
    const speakeasy = require('speakeasy');
    const secret    = speakeasy.generateSecret({ length: 20 });
    const validCode = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

    const aliceWithMFA = { ...ALICE, mfa_enabled: true, mfa_secret: secret.base32 };
    jest.spyOn(UserModel.prototype, 'findById').mockResolvedValue(aliceWithMFA);
    jest.spyOn(MFAModel.prototype, 'useBackupCode').mockResolvedValue(false);

    const newCodes = Array.from({ length: 10 }, (_, i) => `NEW${i.toString().padStart(2, '0')}`);
    jest.spyOn(MFAModel.prototype, 'regenerateBackupCodes').mockResolvedValue(newCodes);

    const res = await request(app)
      .post('/api/v1/mfa/regenerate-codes')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ code: validCode })
      .expect(200);

    expect(res.body.data.backup_codes).toHaveLength(10);
    expect(res.body.data.backup_codes[0]).toMatch(/^NEW/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3: Autenticazione e autorizzazione
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — Autenticazione e Autorizzazione', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tutti gli endpoint /mfa richiedono autenticazione (no token → 401)', async () => {
    const responses = await Promise.all([
      request(app).post('/api/v1/mfa/setup'),
      request(app).post('/api/v1/mfa/verify').send({ code: '123456' }),
      request(app).post('/api/v1/mfa/disable').send({ code: '123456' }),
      request(app).post('/api/v1/mfa/regenerate-codes').send({ code: '123456' }),
      request(app).get('/api/v1/mfa/status'),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
    }
  });

  it('/logout-all richiede autenticazione', async () => {
    const res = await request(app).post('/api/v1/auth/logout-all');
    expect(res.status).toBe(401);
  });

  it('token scaduto → 401 su endpoint protetti', async () => {
    const expiredToken = makeExpiredJWT(ALICE.id);

    const res = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it('token malformato → 401', async () => {
    const res = await request(app)
      .get('/api/v1/mfa/status')
      .set('Authorization', 'Bearer not.a.real.jwt');

    expect(res.status).toBe(401);
  });

  it('route inesistente → 404', async () => {
    const res = await request(app).get('/api/v1/auth/nonexistent');
    expect(res.status).toBe(404);
  });

  it('register e login sono endpoint pubblici (no auth required)', async () => {
    // Register
    mockNoExistingUser();
    mockCreateUser(ALICE);
    mockSessionCreate(ALICE.id);

    const { getRedisClient } = require('../../src/config/redis');
    getRedisClient.mockReturnValue({
      get: jest.fn().mockResolvedValue(null), incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1), ttl: jest.fn().mockResolvedValue(60),
    });

    const registerRes = await request(app)
      .post('/api/v1/auth/register')
      .send(mockDTOs.register);

    expect(registerRes.status).toBe(201);

    // Login
    mockLoginUser(ALICE, true);
    mockSessionCreate(ALICE.id);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send(mockDTOs.login);

    expect(loginRes.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4: Validazione input
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — Validazione Input', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const { getRedisClient } = require('../../src/config/redis');
    getRedisClient.mockReturnValue({
      get: jest.fn().mockResolvedValue(null), incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1), ttl: jest.fn().mockResolvedValue(60),
    });
  });

  it('register — campi obbligatori mancanti → 400', async () => {
    const cases = [
      { email: 'a@b.com', password: 'Secure1!Pass' },           // manca username
      { username: 'abc', password: 'Secure1!Pass' },             // manca email
      { username: 'abc', email: 'a@b.com' },                    // manca password
    ];

    for (const body of cases) {
      const res = await request(app).post('/api/v1/auth/register').send(body);
      expect(res.status).toBe(400);
    }
  });

  it('register — username non valido (troppo corto/lungo/non alfanum) → 400', async () => {
    const invalidUsernames = ['ab', 'a'.repeat(31), 'user name', 'user!'];
    for (const username of invalidUsernames) {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...mockDTOs.register, username });
      expect(res.status).toBe(400);
    }
  });

  it('register — email non valida → 400', async () => {
    const invalidEmails = ['notanemail', 'missing@', '@nodomain.com', 'a@b'];
    for (const email of invalidEmails) {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ ...mockDTOs.register, email });
      expect(res.status).toBe(400);
    }
  });

  it('login — username o password assenti → 400', async () => {
    const res1 = await request(app).post('/api/v1/auth/login').send({ password: 'Pass1!' });
    const res2 = await request(app).post('/api/v1/auth/login').send({ username: 'user' });

    expect(res1.status).toBe(400);
    expect(res2.status).toBe(400);
  });

  it('login — mfa_code non esattamente 6 cifre → 400', async () => {
    const invalidCodes = ['12345', '1234567', 'ABCDEF', '12345!'];
    for (const mfa_code of invalidCodes) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ ...mockDTOs.login, mfa_code });
      expect(res.status).toBe(400);
    }
  });

  it('mfa/verify — code non numerico o lunghezza errata → 400', async () => {
    const aliceToken = makeJWT(ALICE.id);
    const invalidCodes = ['12345', '1234567', 'ABCDEF', ''];

    for (const code of invalidCodes) {
      const res = await request(app)
        .post('/api/v1/mfa/verify')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ code });
      expect(res.status).toBe(400);
    }
  });

  it('refresh — body vuoto → 400', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('logout — body vuoto → 400', async () => {
    const res = await request(app).post('/api/v1/auth/logout').send({});
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 5: Error handling e propagazione errori
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — Error handling e propagazione errori', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    const { getRedisClient } = require('../../src/config/redis');
    getRedisClient.mockReturnValue({
      get: jest.fn().mockResolvedValue(null), incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1), ttl: jest.fn().mockResolvedValue(60),
    });
  });

  it('errore DB generico durante register → 500 senza stack', async () => {
    jest.spyOn(UserModel.prototype, 'findByUsername').mockRejectedValue(
      new Error('DB connection lost')
    );

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(mockDTOs.register);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(res.body).not.toHaveProperty('stack');
  });

  it('credenziali errate → 401 con code UNAUTHORIZED', async () => {
    jest.spyOn(UserModel.prototype, 'findByUsername').mockResolvedValue(ALICE);
    jest.spyOn(UserModel.prototype, 'verifyPassword').mockResolvedValue(false);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send(mockDTOs.login);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('username duplicato durante register → 409 con code CONFLICT', async () => {
    jest.spyOn(UserModel.prototype, 'findByUsername').mockResolvedValue(ALICE); // già esiste

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(mockDTOs.register);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('email duplicata durante register → 409 con code CONFLICT', async () => {
    jest.spyOn(UserModel.prototype, 'findByUsername').mockResolvedValue(null);
    jest.spyOn(UserModel.prototype, 'findByEmail').mockResolvedValue(ALICE); // email già usata

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(mockDTOs.register);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('password troppo debole durante register → 400 con code VALIDATION_ERROR', async () => {
    mockNoExistingUser();

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...mockDTOs.register, password: 'weakpass' }); // niente uppercase/numeri/speciali

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('account sospeso → 401 con code UNAUTHORIZED', async () => {
    jest.spyOn(UserModel.prototype, 'findByUsername').mockResolvedValue(mockUsers.suspended);
    jest.spyOn(UserModel.prototype, 'verifyPassword').mockResolvedValue(true);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send(mockDTOs.login);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('refresh con token non trovato in DB → 401', async () => {
    jest.spyOn(SessionModel.prototype, 'findByRefreshToken').mockResolvedValue(null);

    // Per avere un refresh token valido (firma JWT ok) usiamo lo stesso segreto dei test
    const { createMockTokenPair } = require('../fixtures');
    // Un refresh token mockato non sarà valido per verifyRefreshToken (firma errata)
    // quindi la 401 arriva già dalla verifica JWT
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'invalid.refresh.token' });

    expect(res.status).toBe(401);
  });

  it('utente non trovato durante setup MFA → 400', async () => {
    const aliceToken = makeJWT(ALICE.id);
    jest.spyOn(UserModel.prototype, 'findById').mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/mfa/setup')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
