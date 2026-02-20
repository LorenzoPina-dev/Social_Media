import request from 'supertest';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// ─── CRITICO: jest.mock viene hoistato SOPRA tutti gli import ────────────────
// Il config module viene cachato da Node al primo import. Se settiamo
// process.env dopo gli import, jwt.accessSecret è già undefined.
// L'unico modo sicuro è moccare il config prima che qualsiasi modulo lo importi.
const JWT_SECRET = 'test-secret-at-least-32-chars-long-xxxxxxxxx';

jest.mock('../../src/config', () => ({
  config: {
    env: 'test',
    port: 3009,
    serviceName: 'moderation-service',
    isProduction: false,
    isTest: true,
    database: {
      url: 'postgresql://postgres:postgres@localhost:5432/moderation_test_db',
    },
    redis: { url: 'redis://localhost:6379' },
    kafka: {
      brokers: ['localhost:9092'],
      groupId: 'moderation-test-group',
    },
    jwt: {
      accessSecret: 'test-secret-at-least-32-chars-long-xxxxxxxxx',
    },
    perspective: { apiKey: undefined, apiUrl: 'https://commentanalyzer.googleapis.com/v1alpha1' },
    aws: { region: 'eu-west-1', accessKeyId: undefined, secretAccessKey: undefined },
    services: {
      postServiceUrl: 'http://localhost:3003',
      mediaServiceUrl: 'http://localhost:3004',
    },
    ml: { autoRejectThreshold: 0.8, autoApproveThreshold: 0.2 },
    logLevel: 'silent',
  },
}));

// Mocka subito anche tutto ciò che crea connessioni reali
jest.mock('../../src/config/database', () => ({
  getDatabase: jest.fn(),
  connectDatabase: jest.fn(),
  closeDatabase: jest.fn(),
}));

jest.mock('../../src/config/redis', () => ({
  getRedis: jest.fn().mockReturnValue({
    get: jest.fn(), set: jest.fn(), del: jest.fn(),
    incr: jest.fn(), expire: jest.fn(), quit: jest.fn(), on: jest.fn(),
  }),
  closeRedis: jest.fn(),
}));

jest.mock('../../src/config/kafka', () => ({
  getKafka: jest.fn(),
  getProducer: jest.fn().mockResolvedValue({ connect: jest.fn(), disconnect: jest.fn(), send: jest.fn() }),
  getConsumer: jest.fn().mockResolvedValue({ connect: jest.fn(), subscribe: jest.fn(), run: jest.fn(), disconnect: jest.fn() }),
  disconnectKafka: jest.fn(),
}));

jest.mock('../../src/utils/metrics', () => ({
  register: { contentType: 'text/plain', metrics: jest.fn().mockResolvedValue('') },
  casesCreatedTotal: { inc: jest.fn() },
  decisionsTotal: { inc: jest.fn() },
  mlAnalysisDuration: { startTimer: jest.fn().mockReturnValue(jest.fn()) },
  appealsTotal: { inc: jest.fn() },
  pendingCasesGauge: { set: jest.fn() },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mocca i service (non vogliamo DB reale nei test di integration route)
jest.mock('../../src/services/moderation.service');
jest.mock('../../src/services/review.service');
jest.mock('../../src/services/appeal.service');

// ─── Import DOPO i mock ───────────────────────────────────────────────────────
import { createApp } from '../../src/app';
import { moderationService } from '../../src/services/moderation.service';
import { reviewService } from '../../src/services/review.service';
import { appealService } from '../../src/services/appeal.service';
import { createModerationCaseFixture, createAppealFixture } from '../fixtures';

// ─── Setup mock references ────────────────────────────────────────────────────
const modServiceMock = moderationService as jest.Mocked<typeof moderationService>;
const reviewServiceMock = reviewService as jest.Mocked<typeof reviewService>;
const appealServiceMock = appealService as jest.Mocked<typeof appealService>;

// ─── Token factory ────────────────────────────────────────────────────────────
function makeToken(userId: string): string {
  return jwt.sign(
    {
      userId,
      username: 'testuser',
      email: 'test@example.com',
      verified: true,
      mfa_enabled: false,
      jti: uuidv4(),
    },
    JWT_SECRET,         // stesso secret del config mockato
    { expiresIn: '1h' },
  );
}

const USER_ID = uuidv4();
const MOD_ID = uuidv4();
const USER_TOKEN = `Bearer ${makeToken(USER_ID)}`;
const MOD_TOKEN = `Bearer ${makeToken(MOD_ID)}`;

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('Moderation Routes — Integration', () => {
  // createApp() usa i moduli già mockati sopra
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Health ───────────────────────────────────────────────────────────────
  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  // ─── Report Content ───────────────────────────────────────────────────────
  describe('POST /api/v1/moderation/report', () => {
    it('should return 201 with created case for valid report', async () => {
      const mockCase = createModerationCaseFixture({ reason: 'USER_REPORT' });
      modServiceMock.createCase.mockResolvedValue(mockCase);

      const res = await request(app)
        .post('/api/v1/moderation/report')
        .set('Authorization', USER_TOKEN)
        .send({ entity_id: mockCase.entity_id, entity_type: 'POST', reason: 'USER_REPORT' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockCase.id);
    });

    it('should return 400 for missing entity_id', async () => {
      const res = await request(app)
        .post('/api/v1/moderation/report')
        .set('Authorization', USER_TOKEN)
        .send({ entity_type: 'POST', reason: 'USER_REPORT' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid entity_type', async () => {
      const res = await request(app)
        .post('/api/v1/moderation/report')
        .set('Authorization', USER_TOKEN)
        .send({ entity_id: uuidv4(), entity_type: 'INVALID', reason: 'USER_REPORT' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid reason (AUTO_FLAGGED not allowed here)', async () => {
      const res = await request(app)
        .post('/api/v1/moderation/report')
        .set('Authorization', USER_TOKEN)
        .send({ entity_id: uuidv4(), entity_type: 'POST', reason: 'AUTO_FLAGGED' });

      expect(res.status).toBe(400);
    });

    it('should return 401 without Authorization header', async () => {
      const res = await request(app)
        .post('/api/v1/moderation/report')
        .send({ entity_id: uuidv4(), entity_type: 'POST', reason: 'USER_REPORT' });

      expect(res.status).toBe(401);
    });
  });

  // ─── Get Case by ID ────────────────────────────────────────────────────────
  describe('GET /api/v1/moderation/cases/:id', () => {
    it('should return 200 with case data for admin', async () => {
      const mockCase = createModerationCaseFixture();
      modServiceMock.getCaseById.mockResolvedValue(mockCase);

      const res = await request(app)
        .get(`/api/v1/moderation/cases/${mockCase.id}`)
        .set('Authorization', MOD_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(mockCase.id);
    });

    it('should return 404 for non-existent case', async () => {
      const { NotFoundError } = require('../../src/types');
      modServiceMock.getCaseById.mockRejectedValue(new NotFoundError('Moderation case'));

      const res = await request(app)
        .get(`/api/v1/moderation/cases/${uuidv4()}`)
        .set('Authorization', MOD_TOKEN);

      expect(res.status).toBe(404);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get(`/api/v1/moderation/cases/${uuidv4()}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── Resolve Case ─────────────────────────────────────────────────────────
  describe('POST /api/v1/moderation/cases/:id/resolve', () => {
    it('should return 200 with decision on successful resolve', async () => {
      const mockCase = createModerationCaseFixture({ status: 'PENDING' });
      const mockDecision = {
        id: uuidv4(),
        case_id: mockCase.id,
        decision: 'APPROVED',
        reason: null,
        decided_by: MOD_ID,
        decided_at: new Date(),
      };
      modServiceMock.resolveCase.mockResolvedValue(mockDecision as any);

      const res = await request(app)
        .post(`/api/v1/moderation/cases/${mockCase.id}/resolve`)
        .set('Authorization', MOD_TOKEN)
        .send({ decision: 'APPROVED', reason: 'Content is fine' });

      expect(res.status).toBe(200);
      expect(res.body.data.decision).toBe('APPROVED');
    });

    it('should return 400 for invalid decision value', async () => {
      const res = await request(app)
        .post(`/api/v1/moderation/cases/${uuidv4()}/resolve`)
        .set('Authorization', MOD_TOKEN)
        .send({ decision: 'MAYBE' });

      expect(res.status).toBe(400);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/v1/moderation/cases/${uuidv4()}/resolve`)
        .send({ decision: 'APPROVED' });

      expect(res.status).toBe(401);
    });
  });

  // ─── Assign Case ──────────────────────────────────────────────────────────
  describe('POST /api/v1/moderation/cases/:id/assign', () => {
    it('should return 200 and assign the case to the requesting moderator', async () => {
      const mockCase = createModerationCaseFixture({ status: 'IN_REVIEW', assigned_to: MOD_ID });
      modServiceMock.assignCase.mockResolvedValue(mockCase);

      const res = await request(app)
        .post(`/api/v1/moderation/cases/${mockCase.id}/assign`)
        .set('Authorization', MOD_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data.assigned_to).toBe(MOD_ID);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/v1/moderation/cases/${uuidv4()}/assign`);

      expect(res.status).toBe(401);
    });
  });

  // ─── Cases by Status ──────────────────────────────────────────────────────
  describe('GET /api/v1/moderation/cases/status/:status', () => {
    it('should return 200 with cases list', async () => {
      const cases = [createModerationCaseFixture(), createModerationCaseFixture()];
      modServiceMock.getCasesByStatus.mockResolvedValue(cases);

      const res = await request(app)
        .get('/api/v1/moderation/cases/status/PENDING')
        .set('Authorization', MOD_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/v1/moderation/cases/status/PENDING');
      expect(res.status).toBe(401);
    });
  });

  // ─── Review Queue ─────────────────────────────────────────────────────────
  describe('GET /api/v1/review/queue', () => {
    it('should return 200 with pending cases list', async () => {
      const cases = [createModerationCaseFixture(), createModerationCaseFixture()];
      reviewServiceMock.getQueue.mockResolvedValue(cases);

      const res = await request(app)
        .get('/api/v1/review/queue')
        .set('Authorization', MOD_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 200 filtering by status via query param', async () => {
      reviewServiceMock.getQueue.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/review/queue?status=RESOLVED')
        .set('Authorization', MOD_TOKEN);

      expect(res.status).toBe(200);
      expect(reviewServiceMock.getQueue).toHaveBeenCalledWith('RESOLVED', 20, 0);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/v1/review/queue');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/review/stats', () => {
    it('should return 200 with queue stats', async () => {
      reviewServiceMock.getStats.mockResolvedValue({ pending: 5, in_review: 2, resolved: 100 });

      const res = await request(app)
        .get('/api/v1/review/stats')
        .set('Authorization', MOD_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data.pending).toBe(5);
      expect(res.body.data.in_review).toBe(2);
      expect(res.body.data.resolved).toBe(100);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/v1/review/stats');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/review/cases/:id', () => {
    it('should return 200 with case + decisions', async () => {
      const mockCase = createModerationCaseFixture();
      reviewServiceMock.getCaseWithDecisions.mockResolvedValue({
        case: mockCase,
        decisions: [],
      });

      const res = await request(app)
        .get(`/api/v1/review/cases/${mockCase.id}`)
        .set('Authorization', MOD_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data.case.id).toBe(mockCase.id);
      expect(res.body.data.decisions).toEqual([]);
    });
  });

  // ─── Appeals ──────────────────────────────────────────────────────────────
  describe('POST /api/v1/appeals', () => {
    it('should return 201 for valid appeal submission', async () => {
      const mockAppeal = createAppealFixture({ user_id: USER_ID });
      appealServiceMock.createAppeal.mockResolvedValue(mockAppeal);

      const res = await request(app)
        .post('/api/v1/appeals')
        .set('Authorization', USER_TOKEN)
        .send({
          case_id: uuidv4(),
          reason: 'I believe this content was wrongly flagged by the system.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for reason shorter than 10 chars', async () => {
      const res = await request(app)
        .post('/api/v1/appeals')
        .set('Authorization', USER_TOKEN)
        .send({ case_id: uuidv4(), reason: 'Too short' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing case_id', async () => {
      const res = await request(app)
        .post('/api/v1/appeals')
        .set('Authorization', USER_TOKEN)
        .send({ reason: 'Valid reason for appeal at least 10 chars' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid case_id (not a UUID)', async () => {
      const res = await request(app)
        .post('/api/v1/appeals')
        .set('Authorization', USER_TOKEN)
        .send({ case_id: 'not-a-uuid', reason: 'Valid reason for appeal here' });

      expect(res.status).toBe(400);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post('/api/v1/appeals')
        .send({ case_id: uuidv4(), reason: 'Test reason here for appeal' });

      expect(res.status).toBe(401);
    });

    it('should return 409 if appeal already exists', async () => {
      const { ConflictError } = require('../../src/types');
      appealServiceMock.createAppeal.mockRejectedValue(
        new ConflictError('You have already submitted an appeal for this case'),
      );

      const res = await request(app)
        .post('/api/v1/appeals')
        .set('Authorization', USER_TOKEN)
        .send({ case_id: uuidv4(), reason: 'Duplicate appeal reason here long enough' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/v1/appeals/my', () => {
    it('should return 200 with own appeals list', async () => {
      const appeals = [createAppealFixture({ user_id: USER_ID })];
      appealServiceMock.getAppealsByUser.mockResolvedValue(appeals);

      const res = await request(app)
        .get('/api/v1/appeals/my')
        .set('Authorization', USER_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should pass userId from token to service', async () => {
      appealServiceMock.getAppealsByUser.mockResolvedValue([]);

      await request(app)
        .get('/api/v1/appeals/my')
        .set('Authorization', USER_TOKEN);

      expect(appealServiceMock.getAppealsByUser).toHaveBeenCalledWith(USER_ID, 20, 0);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/v1/appeals/my');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/appeals/:id', () => {
    it('should return 200 with appeal data', async () => {
      const mockAppeal = createAppealFixture({ user_id: USER_ID });
      appealServiceMock.getAppeal.mockResolvedValue(mockAppeal);

      const res = await request(app)
        .get(`/api/v1/appeals/${mockAppeal.id}`)
        .set('Authorization', USER_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(mockAppeal.id);
    });

    it('should return 404 for non-existent appeal', async () => {
      const { NotFoundError } = require('../../src/types');
      appealServiceMock.getAppeal.mockRejectedValue(new NotFoundError('Appeal'));

      const res = await request(app)
        .get(`/api/v1/appeals/${uuidv4()}`)
        .set('Authorization', USER_TOKEN);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/appeals (admin — pending list)', () => {
    it('should return 200 with pending appeals', async () => {
      const appeals = [createAppealFixture(), createAppealFixture()];
      appealServiceMock.getPendingAppeals.mockResolvedValue(appeals);

      const res = await request(app)
        .get('/api/v1/appeals')
        .set('Authorization', MOD_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/v1/appeals');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/appeals/:id/resolve', () => {
    it('should return 200 on granted appeal', async () => {
      const mockAppeal = createAppealFixture({ status: 'GRANTED' });
      appealServiceMock.resolveAppeal.mockResolvedValue(mockAppeal);

      const res = await request(app)
        .post(`/api/v1/appeals/${uuidv4()}/resolve`)
        .set('Authorization', MOD_TOKEN)
        .send({ status: 'GRANTED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('GRANTED');
    });

    it('should return 200 on denied appeal', async () => {
      const mockAppeal = createAppealFixture({ status: 'DENIED' });
      appealServiceMock.resolveAppeal.mockResolvedValue(mockAppeal);

      const res = await request(app)
        .post(`/api/v1/appeals/${uuidv4()}/resolve`)
        .set('Authorization', MOD_TOKEN)
        .send({ status: 'DENIED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('DENIED');
    });

    it('should return 400 for invalid status value', async () => {
      const res = await request(app)
        .post(`/api/v1/appeals/${uuidv4()}/resolve`)
        .set('Authorization', MOD_TOKEN)
        .send({ status: 'MAYBE' });

      expect(res.status).toBe(400);
    });

    it('should return 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/v1/appeals/${uuidv4()}/resolve`)
        .send({ status: 'GRANTED' });

      expect(res.status).toBe(401);
    });
  });
});
