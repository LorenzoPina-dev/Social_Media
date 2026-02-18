/**
 * User E2E Tests — Flussi completi end-to-end
 *
 * Approccio: Express + controller reali + servizi MOCKATI.
 * Permette di testare l'intero stack HTTP (routing → middleware → controller)
 * senza richiedere PostgreSQL / Redis / Kafka attivi.
 *
 * DIFFERENZA rispetto agli integration test:
 * - Gli integration test verificano singoli endpoint isolati.
 * - Gli E2E test verificano SEQUENZE di azioni (lifecycle completo).
 *
 * Per test con infrastruttura reale, lanciare docker-compose e impostare
 * TEST_E2E_REAL=true prima di eseguire jest --testPathPattern=e2e.
 */

// ── mock infrastruttura (prima di qualsiasi import) ─────────────────────────
jest.mock('../../src/config/database', () => ({
  getDatabase:     jest.fn(),
  connectDatabase: jest.fn(),
}));
jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn(), set: jest.fn(), setex: jest.fn(), del: jest.fn(), ping: jest.fn(),
  }),
}));
jest.mock('../../src/config/kafka', () => ({
  getKafkaProducer: jest.fn(),
  connectKafka:     jest.fn(),
}));
jest.mock('../../src/utils/logger', () => ({
  logger:  { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/utils/metrics', () => ({
  metrics:     { incrementCounter: jest.fn(), recordRequestDuration: jest.fn() },
  userMetrics: {
    userCreated:     { inc: jest.fn() }, userUpdated:   { inc: jest.fn() },
    userDeleted:     { inc: jest.fn() }, userRetrieved: { inc: jest.fn() },
    userSearched:    { inc: jest.fn() }, userFollowed:  { inc: jest.fn() },
    userUnfollowed:  { inc: jest.fn() }, requestDuration: { observe: jest.fn() },
    cacheHit:        { inc: jest.fn() }, cacheMiss:     { inc: jest.fn() },
    dbQueryDuration: { observe: jest.fn() },
  },
  default: { incrementCounter: jest.fn() },
}));

jest.mock('../../src/services/user.service');
jest.mock('../../src/services/follower.service');
jest.mock('../../src/services/gdpr.service');

// ─────────────────────────────────────────────────────────────────────────────
import express, { Application } from 'express';
import request  from 'supertest';
import jwt      from 'jsonwebtoken';

import { UserController }     from '../../src/controllers/user.controller';
import { FollowerController } from '../../src/controllers/follower.controller';
import { GDPRController }     from '../../src/controllers/gdpr.controller';
import { UserService }        from '../../src/services/user.service';
import { FollowerService }    from '../../src/services/follower.service';
import { GDPRService }        from '../../src/services/gdpr.service';
import { setupUserRoutes }     from '../../src/routes/user.routes';
import { setupFollowerRoutes } from '../../src/routes/follower.routes';
import { setupGDPRRoutes }     from '../../src/routes/gdpr.routes';
import { User }                from '../../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_ACCESS_SECRET!;

function makeToken(userId: string, email = 'test@example.com'): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '1h' });
}

function buildApp(
  userSvc: jest.Mocked<UserService>,
  followerSvc: jest.Mocked<FollowerService>,
  gdprSvc: jest.Mocked<GDPRService>,
): Application {
  const app = express();
  app.use(express.json());

  const userCtrl     = new UserController(userSvc as any);
  const followerCtrl = new FollowerController(followerSvc as any);
  const gdprCtrl     = new GDPRController(gdprSvc as any);

  app.use('/api/v1/users', setupUserRoutes(userCtrl));
  app.use('/api/v1/users', setupFollowerRoutes(followerCtrl));
  app.use('/api/v1/users', setupGDPRRoutes(gdprCtrl));

  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const USER_A_ID = 'e29a1d12-4f3b-4c8e-a7d2-000000000001';
const USER_B_ID = 'e29a1d12-4f3b-4c8e-a7d2-000000000002';

function makeUser(id: string, overrides: Partial<User> = {}): User {
  return {
    id,
    username:        `user_${id.slice(-4)}`,
    email:           `${id.slice(-4)}@example.com`,
    display_name:    `User ${id.slice(-4)}`,
    verified:        false,
    follower_count:  0,
    following_count: 0,
    status:          'ACTIVE',
    created_at:      new Date('2024-01-01'),
    updated_at:      new Date('2024-01-01'),
    ...overrides,
  };
}

const USER_A = makeUser(USER_A_ID);
const USER_B = makeUser(USER_B_ID);

// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — Profile Lifecycle', () => {
  let app: Application;
  let userSvc: jest.Mocked<UserService>;
  let followerSvc: jest.Mocked<FollowerService>;
  let gdprSvc: jest.Mocked<GDPRService>;
  let authA: string;

  beforeEach(() => {
    jest.clearAllMocks();
    userSvc     = new UserService(null as any, null as any, null as any) as jest.Mocked<UserService>;
    followerSvc = new FollowerService(null as any, null as any, null as any, null as any) as jest.Mocked<FollowerService>;
    gdprSvc     = new GDPRService(null as any, null as any, null as any) as jest.Mocked<GDPRService>;
    app         = buildApp(userSvc, followerSvc, gdprSvc);
    authA       = `Bearer ${makeToken(USER_A_ID)}`;
  });

  it('create → get → update → soft-delete → verify 404', async () => {
    // 1. GET profilo esistente
    userSvc.findById.mockResolvedValueOnce(USER_A);

    const getRes = await request(app)
      .get(`/api/v1/users/${USER_A_ID}`)
      .expect(200);

    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.id).toBe(USER_A_ID);

    // 2. UPDATE profilo
    const updatedUser = { ...USER_A, display_name: 'Updated Name', bio: 'New bio' };
    userSvc.update.mockResolvedValueOnce(updatedUser);

    const updateRes = await request(app)
      .put(`/api/v1/users/${USER_A_ID}`)
      .set('Authorization', authA)
      .send({ display_name: 'Updated Name', bio: 'New bio' })
      .expect(200);

    expect(updateRes.body.data.display_name).toBe('Updated Name');
    expect(updateRes.body.data.bio).toBe('New bio');

    // 3. SOFT DELETE
    userSvc.softDelete.mockResolvedValueOnce(undefined);

    const deleteRes = await request(app)
      .delete(`/api/v1/users/${USER_A_ID}`)
      .set('Authorization', authA)
      .expect(200);

    expect(deleteRes.body.data.gracePeriodDays).toBe(30);

    // 4. GET dopo delete → utente non trovato (softDelete lo nasconde)
    userSvc.findById.mockResolvedValueOnce(null);

    await request(app)
      .get(`/api/v1/users/${USER_A_ID}`)
      .expect(404);
  });

  it('update non autorizzato (utente B tenta di modificare utente A)', async () => {
    const authB = `Bearer ${makeToken(USER_B_ID)}`;

    const res = await request(app)
      .put(`/api/v1/users/${USER_A_ID}`)
      .set('Authorization', authB)
      .send({ display_name: 'Hacked' })
      .expect(403);

    expect(res.body.error).toBe('Forbidden');
    expect(userSvc.update).not.toHaveBeenCalled();
  });

  it('search → richiede parametro q, restituisce risultati paginati', async () => {
    userSvc.search.mockResolvedValue([USER_A, USER_B]);

    const res = await request(app)
      .get('/api/v1/users/search')
      .query({ q: 'user' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toHaveProperty('limit');
    expect(res.body.pagination).toHaveProperty('offset');
  });

  it('search senza q → 400', async () => {
    await request(app)
      .get('/api/v1/users/search')
      .expect(400);

    expect(userSvc.search).not.toHaveBeenCalled();
  });

  it('batch get → restituisce lista utenti per id', async () => {
    userSvc.findByIds.mockResolvedValue([USER_A, USER_B]);

    const res = await request(app)
      .post('/api/v1/users/batch')
      .set('Authorization', authA)
      .send({ ids: [USER_A_ID, USER_B_ID] })
      .expect(200);

    expect(res.body.data).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — Follow Lifecycle', () => {
  let app: Application;
  let userSvc: jest.Mocked<UserService>;
  let followerSvc: jest.Mocked<FollowerService>;
  let gdprSvc: jest.Mocked<GDPRService>;
  let authA: string;

  beforeEach(() => {
    jest.clearAllMocks();
    userSvc     = new UserService(null as any, null as any, null as any) as jest.Mocked<UserService>;
    followerSvc = new FollowerService(null as any, null as any, null as any, null as any) as jest.Mocked<FollowerService>;
    gdprSvc     = new GDPRService(null as any, null as any, null as any) as jest.Mocked<GDPRService>;
    app         = buildApp(userSvc, followerSvc, gdprSvc);
    authA       = `Bearer ${makeToken(USER_A_ID)}`;
  });

  it('A segue B → verifica contatori → A controlla isFollowing → A smette di seguire', async () => {
    // 1. Follow
    followerSvc.follow.mockResolvedValueOnce(undefined);

    const followRes = await request(app)
      .post(`/api/v1/users/${USER_B_ID}/follow`)
      .set('Authorization', authA)
      .expect(200);

    expect(followRes.body.success).toBe(true);
    expect(followerSvc.follow).toHaveBeenCalledWith(USER_A_ID, USER_B_ID);

    // 2. Stats di B
    followerSvc.getStats.mockResolvedValueOnce({ followerCount: 1, followingCount: 0 });

    const statsRes = await request(app)
      .get(`/api/v1/users/${USER_B_ID}/stats`)
      .expect(200);

    expect(statsRes.body.data.followerCount).toBe(1);

    // 3. Check isFollowing A → B
    followerSvc.isFollowing.mockResolvedValueOnce(true);

    const checkRes = await request(app)
      .get(`/api/v1/users/${USER_A_ID}/follows/${USER_B_ID}`)
      .expect(200);

    expect(checkRes.body.data.isFollowing).toBe(true);

    // 4. Lista followers di B
    followerSvc.getFollowers.mockResolvedValueOnce([USER_A]);

    const followersRes = await request(app)
      .get(`/api/v1/users/${USER_B_ID}/followers`)
      .expect(200);

    expect(followersRes.body.data).toHaveLength(1);
    expect(followersRes.body.data[0].id).toBe(USER_A_ID);

    // 5. Lista following di A
    followerSvc.getFollowing.mockResolvedValueOnce([USER_B]);

    const followingRes = await request(app)
      .get(`/api/v1/users/${USER_A_ID}/following`)
      .expect(200);

    expect(followingRes.body.data).toHaveLength(1);
    expect(followingRes.body.data[0].id).toBe(USER_B_ID);

    // 6. Unfollow
    followerSvc.unfollow.mockResolvedValueOnce(undefined);

    const unfollowRes = await request(app)
      .delete(`/api/v1/users/${USER_B_ID}/follow`)
      .set('Authorization', authA)
      .expect(200);

    expect(unfollowRes.body.success).toBe(true);
    expect(followerSvc.unfollow).toHaveBeenCalledWith(USER_A_ID, USER_B_ID);

    // 7. Verifica isFollowing → false dopo unfollow
    followerSvc.isFollowing.mockResolvedValueOnce(false);

    const checkAfterRes = await request(app)
      .get(`/api/v1/users/${USER_A_ID}/follows/${USER_B_ID}`)
      .expect(200);

    expect(checkAfterRes.body.data.isFollowing).toBe(false);
  });

  it('auto-follow (seguire se stessi) → 400', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${USER_A_ID}/follow`)
      .set('Authorization', authA)
      .expect(400);

    expect(res.body.error).toBe('Bad request');
    expect(followerSvc.follow).not.toHaveBeenCalled();
  });

  it('follow duplicato → 400 (Already following)', async () => {
    followerSvc.follow.mockRejectedValueOnce(new Error('Already following'));

    const res = await request(app)
      .post(`/api/v1/users/${USER_B_ID}/follow`)
      .set('Authorization', authA)
      .expect(400);

    expect(res.body.error).toBe('Bad request');
  });

  it('follow utente inesistente → 404', async () => {
    followerSvc.follow.mockRejectedValueOnce(new Error('User not found'));

    await request(app)
      .post('/api/v1/users/nonexistent-uuid/follow')
      .set('Authorization', authA)
      .expect(404);
  });

  it('unfollow senza relazione esistente → 400 (Not following)', async () => {
    followerSvc.unfollow.mockRejectedValueOnce(new Error('Not following'));

    const res = await request(app)
      .delete(`/api/v1/users/${USER_B_ID}/follow`)
      .set('Authorization', authA)
      .expect(400);

    expect(res.body.error).toBe('Bad request');
  });

  it('follow senza autenticazione → 401', async () => {
    await request(app)
      .post(`/api/v1/users/${USER_B_ID}/follow`)
      .expect(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — GDPR Lifecycle', () => {
  let app: Application;
  let userSvc: jest.Mocked<UserService>;
  let followerSvc: jest.Mocked<FollowerService>;
  let gdprSvc: jest.Mocked<GDPRService>;
  let authA: string;

  beforeEach(() => {
    jest.clearAllMocks();
    userSvc     = new UserService(null as any, null as any, null as any) as jest.Mocked<UserService>;
    followerSvc = new FollowerService(null as any, null as any, null as any, null as any) as jest.Mocked<FollowerService>;
    gdprSvc     = new GDPRService(null as any, null as any, null as any) as jest.Mocked<GDPRService>;
    app         = buildApp(userSvc, followerSvc, gdprSvc);
    authA       = `Bearer ${makeToken(USER_A_ID)}`;
  });

  it('export data → delete-request → cancel-deletion → data-status', async () => {
    // 1. Export dati
    const exportPayload = {
      user:       USER_A,
      followers:  [USER_B],
      following:  [],
      exportDate: new Date(),
      format:     'json' as const,
    };
    gdprSvc.exportUserData.mockResolvedValueOnce(exportPayload);

    const exportRes = await request(app)
      .get(`/api/v1/users/${USER_A_ID}/export`)
      .set('Authorization', authA)
      .expect(200);

    expect(exportRes.body.user).toBeDefined();
    expect(exportRes.body.followers).toHaveLength(1);
    expect(exportRes.body.following).toHaveLength(0);
    expect(gdprSvc.exportUserData).toHaveBeenCalledWith(USER_A_ID);

    // 2. Richiesta cancellazione
    gdprSvc.requestDeletion.mockResolvedValueOnce(undefined);

    const deleteReqRes = await request(app)
      .post(`/api/v1/users/${USER_A_ID}/delete-request`)
      .set('Authorization', authA)
      .expect(200);

    expect(deleteReqRes.body.data.gracePeriodDays).toBe(30);
    expect(deleteReqRes.body.data).toHaveProperty('cancelBefore');

    // 3. Data status → PENDING_DELETION
    gdprSvc.getDataStatus.mockResolvedValueOnce({
      userId:            USER_A_ID,
      status:            'PENDING_DELETION',
      deletionScheduled: true,
      deletionDate:      new Date(Date.now() + 30 * 24 * 3600 * 1000),
      dataRetention: {
        profiles:  '30 days after deletion request',
        followers: 'Immediate upon deletion',
        posts:     '30 days after deletion request',
      },
    });

    const statusRes = await request(app)
      .get(`/api/v1/users/${USER_A_ID}/data-status`)
      .set('Authorization', authA)
      .expect(200);

    expect(statusRes.body.data.deletionScheduled).toBe(true);
    expect(statusRes.body.data.deletionDate).toBeDefined();

    // 4. Annulla cancellazione
    gdprSvc.cancelDeletion.mockResolvedValueOnce(undefined);

    const cancelRes = await request(app)
      .post(`/api/v1/users/${USER_A_ID}/cancel-deletion`)
      .set('Authorization', authA)
      .expect(200);

    expect(cancelRes.body.success).toBe(true);

    // 5. Data status → tornato ACTIVE
    gdprSvc.getDataStatus.mockResolvedValueOnce({
      userId:            USER_A_ID,
      status:            'ACTIVE',
      deletionScheduled: false,
      dataRetention: {
        profiles:  '30 days after deletion request',
        followers: 'Immediate upon deletion',
        posts:     '30 days after deletion request',
      },
    });

    const statusAfterRes = await request(app)
      .get(`/api/v1/users/${USER_A_ID}/data-status`)
      .set('Authorization', authA)
      .expect(200);

    expect(statusAfterRes.body.data.status).toBe('ACTIVE');
    expect(statusAfterRes.body.data.deletionScheduled).toBe(false);
  });

  it('export dati di un altro utente → 403', async () => {
    const authB = `Bearer ${makeToken(USER_B_ID)}`;

    await request(app)
      .get(`/api/v1/users/${USER_A_ID}/export`)
      .set('Authorization', authB)
      .expect(403);

    expect(gdprSvc.exportUserData).not.toHaveBeenCalled();
  });

  it('cancel-deletion senza richiesta attiva → 404', async () => {
    gdprSvc.cancelDeletion.mockRejectedValueOnce(new Error('No deletion request found'));

    await request(app)
      .post(`/api/v1/users/${USER_A_ID}/cancel-deletion`)
      .set('Authorization', authA)
      .expect(404);
  });

  it('operazioni GDPR senza autenticazione → 401', async () => {
    await request(app).get(`/api/v1/users/${USER_A_ID}/export`).expect(401);
    await request(app).post(`/api/v1/users/${USER_A_ID}/delete-request`).expect(401);
    await request(app).post(`/api/v1/users/${USER_A_ID}/cancel-deletion`).expect(401);
    await request(app).get(`/api/v1/users/${USER_A_ID}/data-status`).expect(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — Autenticazione e Autorizzazione', () => {
  let app: Application;
  let userSvc: jest.Mocked<UserService>;
  let followerSvc: jest.Mocked<FollowerService>;
  let gdprSvc: jest.Mocked<GDPRService>;

  beforeEach(() => {
    jest.clearAllMocks();
    userSvc     = new UserService(null as any, null as any, null as any) as jest.Mocked<UserService>;
    followerSvc = new FollowerService(null as any, null as any, null as any, null as any) as jest.Mocked<FollowerService>;
    gdprSvc     = new GDPRService(null as any, null as any, null as any) as jest.Mocked<GDPRService>;
    app         = buildApp(userSvc, followerSvc, gdprSvc);
  });

  it('token scaduto → 401', async () => {
    const expiredToken = jwt.sign(
      { userId: USER_A_ID, email: 'a@test.com' },
      JWT_SECRET,
      { expiresIn: '-1s' } // già scaduto
    );

    await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('token malformato → 401', async () => {
    await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', 'Bearer not.a.valid.jwt.at.all')
      .expect(401);
  });

  it('header Authorization assente → 401 sugli endpoint protetti', async () => {
    await request(app).get('/api/v1/users/me').expect(401);
    await request(app).post('/api/v1/users/batch').send({ ids: [USER_A_ID] }).expect(401);
  });

  it('GET /api/v1/users/:id è pubblico (no auth richiesta)', async () => {
    userSvc.findById.mockResolvedValue(USER_A);

    const res = await request(app)
      .get(`/api/v1/users/${USER_A_ID}`)
      // nessun Authorization header
      .expect(200);

    expect(res.body.data.id).toBe(USER_A_ID);
  });

  it('GET /api/v1/users/me autentica e restituisce l\'utente corrente', async () => {
    userSvc.findById.mockResolvedValue(USER_A);

    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${makeToken(USER_A_ID)}`)
      .expect(200);

    expect(res.body.data.id).toBe(USER_A_ID);
    expect(userSvc.findById).toHaveBeenCalledWith(USER_A_ID);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — Validazione Input', () => {
  let app: Application;
  let userSvc: jest.Mocked<UserService>;
  let authA: string;

  beforeEach(() => {
    jest.clearAllMocks();
    userSvc     = new UserService(null as any, null as any, null as any) as jest.Mocked<UserService>;
    const followerSvc = new FollowerService(null as any, null as any, null as any, null as any) as jest.Mocked<FollowerService>;
    const gdprSvc     = new GDPRService(null as any, null as any, null as any) as jest.Mocked<GDPRService>;
    app         = buildApp(userSvc, followerSvc, gdprSvc);
    authA       = `Bearer ${makeToken(USER_A_ID)}`;
  });

  it('bio > 500 caratteri → 400', async () => {
    const res = await request(app)
      .put(`/api/v1/users/${USER_A_ID}`)
      .set('Authorization', authA)
      .send({ bio: 'x'.repeat(501) })
      .expect(400);

    expect(res.body.error).toBe('Validation failed');
    expect(userSvc.update).not.toHaveBeenCalled();
  });

  it('avatar_url non valido (non URI) → 400', async () => {
    const res = await request(app)
      .put(`/api/v1/users/${USER_A_ID}`)
      .set('Authorization', authA)
      .send({ avatar_url: 'not-a-url' })
      .expect(400);

    expect(res.body.error).toBe('Validation failed');
  });

  it('batch con lista > 100 ids → 400', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `${USER_A_ID.slice(0, -2)}${i.toString().padStart(2, '0')}`);

    await request(app)
      .post('/api/v1/users/batch')
      .set('Authorization', authA)
      .send({ ids })
      .expect(400);
  });

  it('batch senza ids → 400', async () => {
    await request(app)
      .post('/api/v1/users/batch')
      .set('Authorization', authA)
      .send({ ids: 'not-an-array' })
      .expect(400);
  });

  it('search senza q → 400', async () => {
    await request(app)
      .get('/api/v1/users/search')
      .expect(400);
  });
});
