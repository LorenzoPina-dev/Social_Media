/**
 * E2E Tests — moderation-service
 *
 * Questi test richiedono:
 *   - PostgreSQL disponibile (moderation_test_db)
 *   - Redis disponibile
 *   - Kafka disponibile (o mock consumer)
 *
 * Esegui con: npm run test:e2e
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import knex from 'knex';
import { createApp } from '../../src/app';

// Mock Kafka per evitare dipendenza in E2E
jest.mock('../../src/config/kafka', () => ({
  getKafka: jest.fn(),
  getProducer: jest.fn().mockResolvedValue({
    connect: jest.fn(),
    disconnect: jest.fn(),
    send: jest.fn().mockResolvedValue(undefined),
  }),
  getConsumer: jest.fn().mockResolvedValue({
    connect: jest.fn(),
    subscribe: jest.fn(),
    run: jest.fn(),
    disconnect: jest.fn(),
  }),
  disconnectKafka: jest.fn().mockResolvedValue(undefined),
}));

// Mock ML service per risultati deterministici
jest.mock('../../src/services/ml.service', () => ({
  mlService: {
    analyzeText: jest.fn().mockResolvedValue({ score: 0.1, categories: { toxicity: 0.1 } }),
    analyzeImage: jest.fn().mockResolvedValue({ safe: true, labels: [], score: 0 }),
  },
  MlService: jest.fn(),
}));

jest.mock('../../src/utils/metrics', () => ({
  register: { contentType: 'text/plain', metrics: jest.fn().mockResolvedValue('') },
  casesCreatedTotal: { inc: jest.fn() },
  decisionsTotal: { inc: jest.fn() },
  mlAnalysisDuration: { startTimer: jest.fn().mockReturnValue(jest.fn()) },
  appealsTotal: { inc: jest.fn() },
  pendingCasesGauge: { set: jest.fn() },
}));

const JWT_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-secret-at-least-32-chars-long-xxxxx';
const DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/moderation_test_db';

let testDb: ReturnType<typeof knex>;

function makeToken(userId: string): string {
  return jwt.sign(
    {
      userId,
      username: 'e2euser',
      email: 'e2e@test.com',
      verified: true,
      mfa_enabled: false,
      jti: uuidv4(),
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = JWT_SECRET;
  process.env.DATABASE_URL = DB_URL;
  process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
  process.env.NODE_ENV = 'test';

  testDb = knex({
    client: 'pg',
    connection: DB_URL,
    migrations: { directory: './migrations', extension: 'ts' },
  });

  await testDb.migrate.latest();
});

afterAll(async () => {
  await testDb.migrate.rollback(undefined, true);
  await testDb.destroy();
});

beforeEach(async () => {
  await testDb.raw('TRUNCATE appeals, moderation_decisions, moderation_cases CASCADE');
});

describe('E2E — Moderation Complete Flows', () => {
  const app = createApp();

  // ──────────────────────────────────────────────────────────────────────────
  describe('Flow 1: User reports content → Admin reviews → Resolves', () => {
    it('should complete the full moderation lifecycle', async () => {
      const userId = uuidv4();
      const adminId = uuidv4();
      const entityId = uuidv4();
      const userToken = `Bearer ${makeToken(userId)}`;
      const adminToken = `Bearer ${makeToken(adminId)}`;

      // Step 1: User reports content
      const reportRes = await request(app)
        .post('/api/v1/moderation/report')
        .set('Authorization', userToken)
        .send({
          entity_id: entityId,
          entity_type: 'POST',
          reason: 'USER_REPORT',
          content: 'This content seems offensive',
        });

      expect(reportRes.status).toBe(201);
      const caseId = reportRes.body.data.id;
      expect(caseId).toBeDefined();
      expect(reportRes.body.data.status).toBe('PENDING');

      // Step 2: Admin fetches the review queue
      const queueRes = await request(app)
        .get('/api/v1/review/queue?status=PENDING')
        .set('Authorization', adminToken);

      expect(queueRes.status).toBe(200);
      expect(queueRes.body.data.length).toBeGreaterThan(0);
      const queuedCase = queueRes.body.data.find((c: any) => c.id === caseId);
      expect(queuedCase).toBeDefined();

      // Step 3: Admin assigns the case to themselves
      const assignRes = await request(app)
        .post(`/api/v1/moderation/cases/${caseId}/assign`)
        .set('Authorization', adminToken);

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.data.assigned_to).toBe(adminId);
      expect(assignRes.body.data.status).toBe('IN_REVIEW');

      // Step 4: Admin resolves the case (approves)
      const resolveRes = await request(app)
        .post(`/api/v1/moderation/cases/${caseId}/resolve`)
        .set('Authorization', adminToken)
        .send({ decision: 'APPROVED', reason: 'Content complies with guidelines' });

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.data.decision).toBe('APPROVED');

      // Step 5: Verify case is now resolved with decision
      const detailRes = await request(app)
        .get(`/api/v1/review/cases/${caseId}`)
        .set('Authorization', adminToken);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.case.status).toBe('RESOLVED');
      expect(detailRes.body.data.decisions).toHaveLength(1);
      expect(detailRes.body.data.decisions[0].decision).toBe('APPROVED');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Flow 2: Rejected content → User appeals → Admin grants appeal', () => {
    it('should complete the full appeal lifecycle', async () => {
      const userId = uuidv4();
      const adminId = uuidv4();
      const entityId = uuidv4();
      const userToken = `Bearer ${makeToken(userId)}`;
      const adminToken = `Bearer ${makeToken(adminId)}`;

      // Step 1: Create a case manually via report
      const reportRes = await request(app)
        .post('/api/v1/moderation/report')
        .set('Authorization', userToken)
        .send({
          entity_id: entityId,
          entity_type: 'POST',
          reason: 'USER_REPORT',
        });

      expect(reportRes.status).toBe(201);
      const caseId = reportRes.body.data.id;

      // Step 2: Admin rejects it
      await request(app)
        .post(`/api/v1/moderation/cases/${caseId}/resolve`)
        .set('Authorization', adminToken)
        .send({ decision: 'REJECTED', reason: 'Violates community guidelines' });

      // Step 3: User submits appeal
      const appealRes = await request(app)
        .post('/api/v1/appeals')
        .set('Authorization', userToken)
        .send({
          case_id: caseId,
          reason:
            'I believe this content was wrongly rejected. It fully complies with all guidelines and is educational in nature.',
        });

      expect(appealRes.status).toBe(201);
      const appealId = appealRes.body.data.id;
      expect(appealRes.body.data.status).toBe('PENDING');

      // Step 4: User cannot submit duplicate appeal
      const duplicateRes = await request(app)
        .post('/api/v1/appeals')
        .set('Authorization', userToken)
        .send({
          case_id: caseId,
          reason: 'Duplicate appeal attempt here',
        });

      expect(duplicateRes.status).toBe(409);

      // Step 5: Admin views pending appeals
      const pendingAppealsRes = await request(app)
        .get('/api/v1/appeals')
        .set('Authorization', adminToken);

      expect(pendingAppealsRes.status).toBe(200);
      const pendingAppeal = pendingAppealsRes.body.data.find((a: any) => a.id === appealId);
      expect(pendingAppeal).toBeDefined();

      // Step 6: Admin grants appeal
      const resolveAppealRes = await request(app)
        .post(`/api/v1/appeals/${appealId}/resolve`)
        .set('Authorization', adminToken)
        .send({ status: 'GRANTED' });

      expect(resolveAppealRes.status).toBe(200);
      expect(resolveAppealRes.body.data.status).toBe('GRANTED');

      // Step 7: Case should now have an APPROVED decision
      const caseDetailRes = await request(app)
        .get(`/api/v1/review/cases/${caseId}`)
        .set('Authorization', adminToken);

      expect(caseDetailRes.status).toBe(200);
      const decisions = caseDetailRes.body.data.decisions;
      const hasApproved = decisions.some((d: any) => d.decision === 'APPROVED');
      expect(hasApproved).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Flow 3: Review stats dashboard', () => {
    it('should track stats correctly as cases are created and resolved', async () => {
      const adminId = uuidv4();
      const userId = uuidv4();
      const adminToken = `Bearer ${makeToken(adminId)}`;
      const userToken = `Bearer ${makeToken(userId)}`;

      // Initial stats
      const initialStats = await request(app)
        .get('/api/v1/review/stats')
        .set('Authorization', adminToken);

      expect(initialStats.status).toBe(200);
      const initialPending = initialStats.body.data.pending;

      // Create 3 cases
      const entityIds = [uuidv4(), uuidv4(), uuidv4()];
      const caseIds: string[] = [];

      for (const entityId of entityIds) {
        const res = await request(app)
          .post('/api/v1/moderation/report')
          .set('Authorization', userToken)
          .send({ entity_id: entityId, entity_type: 'POST', reason: 'USER_REPORT' });
        caseIds.push(res.body.data.id);
      }

      // Stats should show 3 more pending
      const afterCreate = await request(app)
        .get('/api/v1/review/stats')
        .set('Authorization', adminToken);

      expect(afterCreate.body.data.pending).toBe(initialPending + 3);

      // Resolve one case
      await request(app)
        .post(`/api/v1/moderation/cases/${caseIds[0]}/resolve`)
        .set('Authorization', adminToken)
        .send({ decision: 'APPROVED' });

      // Stats should show 2 pending and 1 resolved
      const afterResolve = await request(app)
        .get('/api/v1/review/stats')
        .set('Authorization', adminToken);

      expect(afterResolve.body.data.pending).toBe(initialPending + 2);
      expect(afterResolve.body.data.resolved).toBeGreaterThan(0);
    });
  });
});
