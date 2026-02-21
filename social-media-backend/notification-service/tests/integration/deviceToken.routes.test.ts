/**
 * Integration Tests — Device Token Routes
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { setupDeviceTokenRoutes } from '../../src/routes/deviceToken.routes';
import { DeviceTokenController } from '../../src/controllers/deviceToken.controller';
import { DeviceTokenService } from '../../src/services/deviceToken.service';
import { errorHandler } from '../../src/middleware/errorHandler';
import { createDeviceTokenFixture } from '../fixtures';

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
const TEST_USER_ID = 'device-user-id-789';

function generateToken(userId = TEST_USER_ID): string {
  return jwt.sign(
    { userId, username: 'deviceuser', email: 'device@example.com', verified: true },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SETUP
// ──────────────────────────────────────────────────────────────────────────

let app: express.Application;
let mockDeviceTokenService: jest.Mocked<DeviceTokenService>;

beforeEach(() => {
  jest.clearAllMocks();

  mockDeviceTokenService = {
    register: jest.fn(),
    unregister: jest.fn(),
    getUserTokens: jest.fn(),
  } as unknown as jest.Mocked<DeviceTokenService>;

  const controller = new DeviceTokenController(mockDeviceTokenService);

  app = express();
  app.use(express.json());
  app.use('/api/v1/notifications/devices', setupDeviceTokenRoutes(controller));
  app.use(errorHandler);
});

// ──────────────────────────────────────────────────────────────────────────
// TESTS
// ──────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/notifications/devices', () => {
  it('should return 201 when device token is registered', async () => {
    const deviceToken = createDeviceTokenFixture({ user_id: TEST_USER_ID, platform: 'ANDROID' });
    mockDeviceTokenService.register = jest.fn().mockResolvedValue(deviceToken);

    const res = await request(app)
      .post('/api/v1/notifications/devices')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ token: 'fcm-test-token-abc123', platform: 'ANDROID' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockDeviceTokenService.register).toHaveBeenCalledWith(
      TEST_USER_ID,
      'fcm-test-token-abc123',
      'ANDROID',
    );
  });

  it('should return 201 for iOS platform', async () => {
    const deviceToken = createDeviceTokenFixture({ platform: 'IOS' });
    mockDeviceTokenService.register = jest.fn().mockResolvedValue(deviceToken);

    const res = await request(app)
      .post('/api/v1/notifications/devices')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ token: 'apns-test-token-xyz', platform: 'IOS' });

    expect(res.status).toBe(201);
  });

  it('should return 201 for WEB platform', async () => {
    const deviceToken = createDeviceTokenFixture({ platform: 'WEB' });
    mockDeviceTokenService.register = jest.fn().mockResolvedValue(deviceToken);

    const res = await request(app)
      .post('/api/v1/notifications/devices')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ token: 'web-push-subscription-token', platform: 'WEB' });

    expect(res.status).toBe(201);
  });

  it('should return 400 when token is missing', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/devices')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ platform: 'ANDROID' }); // missing token

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid platform', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/devices')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ token: 'some-token', platform: 'WINDOWS' }); // invalid platform

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when token exceeds 500 chars', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/devices')
      .set('Authorization', `Bearer ${generateToken()}`)
      .send({ token: 'a'.repeat(501), platform: 'ANDROID' });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/devices')
      .send({ token: 'some-token', platform: 'ANDROID' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/notifications/devices', () => {
  it('should return 200 with list of device tokens', async () => {
    const tokens = [
      createDeviceTokenFixture({ user_id: TEST_USER_ID, platform: 'IOS' }),
      createDeviceTokenFixture({ user_id: TEST_USER_ID, platform: 'ANDROID' }),
    ];
    mockDeviceTokenService.getUserTokens = jest.fn().mockResolvedValue(tokens);

    const res = await request(app)
      .get('/api/v1/notifications/devices')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('should return empty list for user without tokens', async () => {
    mockDeviceTokenService.getUserTokens = jest.fn().mockResolvedValue([]);

    const res = await request(app)
      .get('/api/v1/notifications/devices')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/v1/notifications/devices');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/notifications/devices/:token', () => {
  it('should return 200 when device token is unregistered', async () => {
    mockDeviceTokenService.unregister = jest.fn().mockResolvedValue(true);
    const tokenValue = 'fcm-token-to-delete-123';

    const res = await request(app)
      .delete(`/api/v1/notifications/devices/${tokenValue}`)
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDeviceTokenService.unregister).toHaveBeenCalledWith(TEST_USER_ID, tokenValue);
  });

  it('should return 404 when device token does not exist', async () => {
    mockDeviceTokenService.unregister = jest.fn().mockResolvedValue(false);

    const res = await request(app)
      .delete('/api/v1/notifications/devices/non-existent-token')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).delete('/api/v1/notifications/devices/some-token');
    expect(res.status).toBe(401);
  });
});
