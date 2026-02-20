/**
 * UserController + FollowerController + GDPRController — Integration Tests
 *
 * Approccio: crea un'app Express minimale con i controller reali
 * ma con servizi completamente mockati, così si testa l'intero
 * layer HTTP (routing → middleware → controller → risposta)
 * senza dipendenze infrastrutturali (DB/Redis/Kafka).
 */

// ── mock prima di qualsiasi import ────────────────────────────────────────
jest.mock('../../src/config/database', () => ({ getDatabase: jest.fn(), connectDatabase: jest.fn() }));
jest.mock('../../src/config/redis',    () => ({ getRedisClient: jest.fn().mockReturnValue({
  get: jest.fn(), set: jest.fn(), setex: jest.fn(), del: jest.fn(), ping: jest.fn(),
}) }));
jest.mock('../../src/config/kafka',    () => ({ getKafkaProducer: jest.fn(), connectKafka: jest.fn() }));
jest.mock('../../src/utils/logger',    () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../../src/utils/metrics',   () => ({
  metrics: { incrementCounter: jest.fn(), recordRequestDuration: jest.fn() },
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

// Mock servizi (le classi — i metodi vengono aggiunti manualmente dopo)
jest.mock('../../src/services/user.service');
jest.mock('../../src/services/follower.service');
jest.mock('../../src/services/gdpr.service');

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

  app.use('*', (_, res) => res.status(404).json({ error: 'Not found' }));
  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const USER_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
const OTHER_ID = 'b7e23ec2-7b9f-4f5e-9d3f-1c6a8d2a5e9f';

const MOCK_USER: User = {
  id:             USER_ID,
  username:       'ctrluser',
  email:          'ctrl@example.com',
  display_name:   'Ctrl User',
  verified:       true,
  follower_count: 0,
  following_count: 0,
  status:         'ACTIVE',
  created_at:     new Date('2024-01-01'),
  updated_at:     new Date('2024-01-01'),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('UserController (integration)', () => {
  let app: Application;
  let userService: jest.Mocked<UserService>;
  let followerService: jest.Mocked<FollowerService>;
  let gdprService: jest.Mocked<GDPRService>;
  let authHeader: string;

  beforeEach(() => {
    jest.clearAllMocks();

    userService     = new UserService(null as any, null as any, null as any) as jest.Mocked<UserService>;
    followerService = new FollowerService(null as any, null as any, null as any, null as any) as jest.Mocked<FollowerService>;
    gdprService     = new GDPRService(null as any, null as any, null as any) as jest.Mocked<GDPRService>;

    app        = buildApp(userService, followerService, gdprService);
    authHeader = `Bearer ${makeToken(USER_ID)}`;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/users/:id', () => {
    it('200 – restituisce l\'utente trovato', async () => {
      userService.findById.mockResolvedValue(MOCK_USER);

      const res = await request(app).get(`/api/v1/users/${USER_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(USER_ID);
    });

    it('404 – utente non trovato', async () => {
      userService.findById.mockResolvedValue(null);

      const res = await request(app).get('/api/v1/users/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('500 – errore interno del server', async () => {
      userService.findById.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get(`/api/v1/users/${USER_ID}`);

      expect(res.status).toBe(500);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/users/me', () => {
    it('200 – restituisce l\'utente autenticato', async () => {
      userService.findById.mockResolvedValue(MOCK_USER);

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(USER_ID);
    });

    it('401 – senza token di autenticazione', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(401);
    });

    it('401 – token non valido', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(res.status).toBe(401);
    });

    it('404 – utente autenticato non trovato nel DB', async () => {
      userService.findById.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('PUT /api/v1/users/:id', () => {
    const UPDATE = { display_name: 'Updated Name', bio: 'New bio' };

    it('200 – aggiorna il profilo dell\'utente autenticato', async () => {
      userService.update.mockResolvedValue({ ...MOCK_USER, ...UPDATE });

      const res = await request(app)
        .put(`/api/v1/users/${USER_ID}`)
        .set('Authorization', authHeader)
        .send(UPDATE);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.display_name).toBe('Updated Name');
    });

    it('403 – impossibile aggiornare il profilo di un altro utente', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${OTHER_ID}`)
        .set('Authorization', authHeader)
        .send(UPDATE);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('401 – senza autenticazione', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${USER_ID}`)
        .send(UPDATE);

      expect(res.status).toBe(401);
    });

    it('400 – dati non validi (bio troppo lunga)', async () => {
      const res = await request(app)
        .put(`/api/v1/users/${USER_ID}`)
        .set('Authorization', authHeader)
        .send({ bio: 'x'.repeat(501) });

      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('DELETE /api/v1/users/:id', () => {
    it('200 – soft delete dell\'utente autenticato con grace period', async () => {
      userService.softDelete.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/v1/users/${USER_ID}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.gracePeriodDays).toBe(30);
    });

    it('403 – impossibile eliminare l\'account di un altro utente', async () => {
      const res = await request(app)
        .delete(`/api/v1/users/${OTHER_ID}`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(403);
    });

    it('401 – senza autenticazione', async () => {
      const res = await request(app).delete(`/api/v1/users/${USER_ID}`);
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/users/search', () => {
    it('200 – restituisce risultati della ricerca', async () => {
      userService.search.mockResolvedValue([MOCK_USER]);

      const res = await request(app)
        .get('/api/v1/users/search')
        .query({ q: 'ctrl' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('400 – senza parametro q', async () => {
      const res = await request(app).get('/api/v1/users/search');
      expect(res.status).toBe(400);
    });

    it('200 – restituisce array vuoto se nessun risultato', async () => {
      userService.search.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/users/search')
        .query({ q: 'nessuno' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/users/batch', () => {
    it('200 – restituisce gli utenti richiesti', async () => {
      userService.findByIds.mockResolvedValue([MOCK_USER]);

      const res = await request(app)
        .post('/api/v1/users/batch')
        .set('Authorization', authHeader)
        .send({ ids: [USER_ID] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('400 – ids non è un array', async () => {
      const res = await request(app)
        .post('/api/v1/users/batch')
        .set('Authorization', authHeader)
        .send({ ids: 'not-an-array' });

      expect(res.status).toBe(400);
    });

    it('400 – più di 100 ids', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);

      const res = await request(app)
        .post('/api/v1/users/batch')
        .set('Authorization', authHeader)
        .send({ ids });

      expect(res.status).toBe(400);
    });

    it('401 – senza autenticazione', async () => {
      const res = await request(app)
        .post('/api/v1/users/batch')
        .send({ ids: [USER_ID] });

      expect(res.status).toBe(401);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('FollowerController (integration)', () => {
  let app: Application;
  let userService: jest.Mocked<UserService>;
  let followerService: jest.Mocked<FollowerService>;
  let authHeader: string;

  beforeEach(() => {
    jest.clearAllMocks();

    userService     = new UserService(null as any, null as any, null as any) as jest.Mocked<UserService>;
    followerService = new FollowerService(null as any, null as any, null as any, null as any) as jest.Mocked<FollowerService>;

    app        = buildApp(userService, followerService, new GDPRService(null as any, null as any, null as any) as jest.Mocked<GDPRService>);
    authHeader = `Bearer ${makeToken(USER_ID)}`;
  });

  const OTHER_USER: User = { ...MOCK_USER, id: OTHER_ID };

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/users/:id/follow', () => {
    it('200 – follow riuscito', async () => {
      followerService.follow.mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/api/v1/users/${OTHER_ID}/follow`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('400 – impossibile seguire se stesso', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${USER_ID}/follow`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad request');
    });

    it('404 – utente da seguire non trovato', async () => {
      followerService.follow.mockRejectedValue(new Error('User not found'));

      const res = await request(app)
        .post(`/api/v1/users/${OTHER_ID}/follow`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
    });

    it('400 – già si sta seguendo l\'utente', async () => {
      followerService.follow.mockRejectedValue(new Error('Already following'));

      const res = await request(app)
        .post(`/api/v1/users/${OTHER_ID}/follow`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
    });

    it('401 – senza autenticazione', async () => {
      const res = await request(app).post(`/api/v1/users/${OTHER_ID}/follow`);
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('DELETE /api/v1/users/:id/follow', () => {
    it('200 – unfollow riuscito', async () => {
      followerService.unfollow.mockResolvedValue(undefined);

      const res = await request(app)
        .delete(`/api/v1/users/${OTHER_ID}/follow`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('400 – non si sta seguendo l\'utente', async () => {
      followerService.unfollow.mockRejectedValue(new Error('Not following'));

      const res = await request(app)
        .delete(`/api/v1/users/${OTHER_ID}/follow`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(400);
    });

    it('401 – senza autenticazione', async () => {
      const res = await request(app).delete(`/api/v1/users/${OTHER_ID}/follow`);
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/users/:id/followers', () => {
    it('200 – restituisce lista followers con paginazione', async () => {
      followerService.getFollowers.mockResolvedValue([OTHER_USER]);

      const res = await request(app)
        .get(`/api/v1/users/${USER_ID}/followers`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination).toHaveProperty('limit');
      expect(res.body.pagination).toHaveProperty('offset');
    });

    it('200 – array vuoto se nessun follower', async () => {
      followerService.getFollowers.mockResolvedValue([]);

      const res = await request(app).get(`/api/v1/users/${USER_ID}/followers`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('passa limit e offset al service', async () => {
      followerService.getFollowers.mockResolvedValue([]);

      await request(app)
        .get(`/api/v1/users/${USER_ID}/followers`)
        .query({ limit: '5', offset: '10' });

      expect(followerService.getFollowers).toHaveBeenCalledWith(
        USER_ID, { limit: 5, offset: 10 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/users/:id/following', () => {
    it('200 – restituisce lista following con paginazione', async () => {
      followerService.getFollowing.mockResolvedValue([OTHER_USER]);

      const res = await request(app).get(`/api/v1/users/${USER_ID}/following`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/users/:id/follows/:targetId', () => {
    it('200 – restituisce isFollowing:true', async () => {
      followerService.isFollowing.mockResolvedValue(true);

      const res = await request(app)
        .get(`/api/v1/users/${USER_ID}/follows/${OTHER_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isFollowing).toBe(true);
    });

    it('200 – restituisce isFollowing:false', async () => {
      followerService.isFollowing.mockResolvedValue(false);

      const res = await request(app)
        .get(`/api/v1/users/${USER_ID}/follows/${OTHER_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isFollowing).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/users/:id/stats', () => {
    it('200 – restituisce followerCount e followingCount', async () => {
      followerService.getStats.mockResolvedValue({ followerCount: 42, followingCount: 17 });

      const res = await request(app).get(`/api/v1/users/${USER_ID}/stats`);

      expect(res.status).toBe(200);
      expect(res.body.data.followerCount).toBe(42);
      expect(res.body.data.followingCount).toBe(17);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('GDPRController (integration)', () => {
  let app: Application;
  let gdprService: jest.Mocked<GDPRService>;
  let authHeader: string;

  beforeEach(() => {
    jest.clearAllMocks();

    gdprService = new GDPRService(null as any, null as any, null as any) as jest.Mocked<GDPRService>;

    app = buildApp(
      new UserService(null as any, null as any, null as any) as jest.Mocked<UserService>,
      new FollowerService(null as any, null as any, null as any, null as any) as jest.Mocked<FollowerService>,
      gdprService,
    );
    authHeader = `Bearer ${makeToken(USER_ID)}`;
  });

  const EXPORT_DATA = {
    user:       MOCK_USER,
    followers:  [],
    following:  [],
    exportDate: new Date().toISOString(),
    format:     'json' as const,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/users/:id/export', () => {
    it('200 – esporta i dati dell\'utente autenticato', async () => {
      gdprService.exportUserData.mockResolvedValue(EXPORT_DATA as any);

      const res = await request(app)
        .get(`/api/v1/users/${USER_ID}/export`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('followers');
      expect(res.body).toHaveProperty('following');
    });

    it('403 – impossibile esportare i dati di un altro utente', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${OTHER_ID}/export`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(403);
    });

    it('401 – senza autenticazione', async () => {
      const res = await request(app).get(`/api/v1/users/${USER_ID}/export`);
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/users/:id/delete-request', () => {
    it('200 – richiede la cancellazione con grace period 30 giorni', async () => {
      gdprService.requestDeletion.mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/api/v1/users/${USER_ID}/delete-request`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.gracePeriodDays).toBe(30);
      expect(res.body.data).toHaveProperty('cancelBefore');
    });

    it('403 – impossibile richiedere la cancellazione per un altro utente', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${OTHER_ID}/delete-request`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(403);
    });

    it('401 – senza autenticazione', async () => {
      const res = await request(app).post(`/api/v1/users/${USER_ID}/delete-request`);
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('POST /api/v1/users/:id/cancel-deletion', () => {
    it('200 – cancella la richiesta di eliminazione', async () => {
      gdprService.cancelDeletion.mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/api/v1/users/${USER_ID}/cancel-deletion`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('403 – impossibile cancellare la richiesta di un altro utente', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${OTHER_ID}/cancel-deletion`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(403);
    });

    it('404 – nessuna richiesta di cancellazione attiva', async () => {
      gdprService.cancelDeletion.mockRejectedValue(new Error('No deletion request found'));

      const res = await request(app)
        .post(`/api/v1/users/${USER_ID}/cancel-deletion`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
    });

    it('401 – senza autenticazione', async () => {
      const res = await request(app).post(`/api/v1/users/${USER_ID}/cancel-deletion`);
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('GET /api/v1/users/:id/data-status', () => {
    it('200 – restituisce lo status dei dati dell\'utente', async () => {
      gdprService.getDataStatus.mockResolvedValue({
        userId:            USER_ID,
        status:            'ACTIVE',
        deletionScheduled: false,
        dataRetention: {
          profiles:  '30 days after deletion request',
          followers: 'Immediate upon deletion',
          posts:     '30 days after deletion request',
        },
      });

      const res = await request(app)
        .get(`/api/v1/users/${USER_ID}/data-status`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.deletionScheduled).toBe(false);
      expect(res.body.data.dataRetention).toHaveProperty('profiles');
    });

    it('403 – impossibile vedere lo status di un altro utente', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${OTHER_ID}/data-status`)
        .set('Authorization', authHeader);

      expect(res.status).toBe(403);
    });

    it('401 – senza autenticazione', async () => {
      const res = await request(app).get(`/api/v1/users/${USER_ID}/data-status`);
      expect(res.status).toBe(401);
    });
  });
});
