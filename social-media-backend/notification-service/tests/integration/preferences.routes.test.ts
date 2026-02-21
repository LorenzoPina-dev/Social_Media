/**
 * Integration Tests — Preferences Routes
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { setupPreferencesRoutes } from '../../src/routes/preferences.routes';
import { PreferencesController } from '../../src/controllers/preferences.controller';
import { PreferencesService } from '../../src/services/preferences.service';
import { errorHandler } from '../../src/middleware/errorHandler';
import { createPreferencesFixture } from '../fixtures';

// ──────────────────────────────────────────────────────────────────────────
// MOCKS
// ──────────────────────────────────────────────────────────────────────────

jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(60),
  }),
}));

// ──────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-jwt-secret-key-for-testing';
const TEST_USER_ID = 'pref-user-id-456';

function generateToken(userId = TEST_USER_ID): string {
  return jwt.sign(
    { userId, username: 'prefuser', email: 'pref@example.com', verified: true },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SETUP
// ──────────────────────────────────────────────────────────────────────────

let app: express.Application;
let mockPreferencesService: jest.Mocked<PreferencesService>;

beforeEach(() => {
  jest.clearAllMocks();

  mockPreferencesService = {
    get: jest.fn(),
    update: jest.fn(),
  } as unknown as jest.Mocked<PreferencesService>;

  const controller = new PreferencesController(mockPreferencesService);

  app = express();
  app.use(express.json());
  app.use('/api/v1/notifications/preferences', setupPreferencesRoutes(controller));
  app.use(errorHandler);
});

// ──────────────────────────────────────────────────────────────────────────
// TESTS
// ──────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/notifications/preferences', () => {
  it('should return 200 with current preferences', async () => {
    const prefs = createPreferencesFixture({ user_id: TEST_USER_ID });
    mockPreferencesService.get = jest.fn().mockResolvedValue(prefs);

    const res = await request(app)
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user_id).toBe(TEST_USER_ID);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/v1/notifications/preferences');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/notifications/preferences', () => {
  it('should return 200 with updated preferences', async () => {
    const updated = createPreferencesFixture({ user_id: TEST_USER_ID, likes_push: false });
    mockPreferencesService.update = jest.fn().mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ likes_push: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.likes_push).toBe(false);
  });

  it('should return 400 for invalid quiet_hours_start format', async () => {
    const res = await request(app)
      .put('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ quiet_hours_start: '25:99' }); // ora invalida

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should accept valid quiet hours HH:MM format', async () => {
    const updated = createPreferencesFixture({
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
    });
    mockPreferencesService.update = jest.fn().mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ quiet_hours_start: '22:00', quiet_hours_end: '08:00' });

    expect(res.status).toBe(200);
    expect(mockPreferencesService.update).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ quiet_hours_start: '22:00', quiet_hours_end: '08:00' }),
    );
  });

  it('should accept null to clear quiet hours', async () => {
    const updated = createPreferencesFixture({ quiet_hours_start: undefined, quiet_hours_end: undefined });
    mockPreferencesService.update = jest.fn().mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ quiet_hours_start: null, quiet_hours_end: null });

    expect(res.status).toBe(200);
  });

  it('should ignore unknown fields (strip unknown)', async () => {
    const updated = createPreferencesFixture();
    mockPreferencesService.update = jest.fn().mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ likes_push: true, unknown_field: 'should be stripped' });

    expect(res.status).toBe(200);
    expect(mockPreferencesService.update).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.not.objectContaining({ unknown_field: expect.anything() }),
    );
  });

  it('should return 401 without auth', async () => {
    const res = await request(app)
      .put('/api/v1/notifications/preferences')
      .send({ likes_push: false });
    expect(res.status).toBe(401);
  });
});
