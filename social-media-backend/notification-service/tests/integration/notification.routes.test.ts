/**
 * Integration Tests — Notification Routes
 *
 * Usa Supertest + Express app.
 * Mocker tutte le dipendenze infrastrutturali (DB, Redis, Kafka, Socket.io).
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { setupNotificationRoutes } from '../../src/routes/notification.routes';
import { NotificationController } from '../../src/controllers/notification.controller';
import { NotificationService } from '../../src/services/notification.service';
import { errorHandler } from '../../src/middleware/errorHandler';
import {
  createNotificationFixture,
} from '../fixtures';

// ──────────────────────────────────────────────────────────────────────────
// MOCKS
// ──────────────────────────────────────────────────────────────────────────

jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(0),
    del: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(60),
  }),
}));

jest.mock('../../src/services/websocket.service', () => ({
  websocketService: {
    emitToUser: jest.fn().mockResolvedValue(false),
    isUserOnline: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../src/services/push.service', () => ({
  pushService: { sendToDevices: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }) },
}));

jest.mock('../../src/services/email.service', () => ({
  emailService: { send: jest.fn().mockResolvedValue(true) },
}));

// ──────────────────────────────────────────────────────────────────────────
// TEST HELPERS
// ──────────────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-jwt-secret-key-for-testing';
const TEST_USER_ID = 'test-user-id-123';

function generateToken(userId = TEST_USER_ID): string {
  return jwt.sign(
    { userId, username: 'testuser', email: 'test@example.com', verified: true },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ──────────────────────────────────────────────────────────────────────────
// SETUP
// ──────────────────────────────────────────────────────────────────────────

let app: express.Application;
let mockNotificationService: jest.Mocked<NotificationService>;

beforeEach(() => {
  jest.clearAllMocks();

  // Crea mock del service
  mockNotificationService = {
    notify: jest.fn(),
    getNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteUserData: jest.fn(),
  } as unknown as jest.Mocked<NotificationService>;

  const controller = new NotificationController(mockNotificationService);

  app = express();
  app.use(express.json());
  app.use('/api/v1/notifications', setupNotificationRoutes(controller));
  app.use(errorHandler);
});

// ──────────────────────────────────────────────────────────────────────────
// TESTS
// ──────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/notifications', () => {
  it('should return 200 with paginated notifications for authenticated user', async () => {
    const notifications = [
      createNotificationFixture({ recipient_id: TEST_USER_ID }),
      createNotificationFixture({ recipient_id: TEST_USER_ID }),
    ];
    mockNotificationService.getNotifications = jest.fn().mockResolvedValue({
      notifications,
      hasMore: false,
      nextCursor: undefined,
    });

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.hasMore).toBe(false);
  });

  it('should return 401 without Authorization header', async () => {
    const res = await request(app).get('/api/v1/notifications');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', 'Bearer invalid-token-xyz');

    expect(res.status).toBe(401);
  });

  it('should return 401 with expired token', async () => {
    const expiredToken = jwt.sign(
      { userId: TEST_USER_ID, username: 'user', email: 'test@example.com', verified: true },
      JWT_SECRET,
      { expiresIn: '-1s' },
    );

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it('should accept optional cursor query param', async () => {
    mockNotificationService.getNotifications = jest.fn().mockResolvedValue({
      notifications: [],
      hasMore: false,
    });

    const res = await request(app)
      .get('/api/v1/notifications')
      .query({ cursor: Buffer.from('2025-01-01T00:00:00.000Z').toString('base64') })
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
      TEST_USER_ID,
      20,
      expect.any(String),
    );
  });

  it('should return 400 when limit exceeds 50', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .query({ limit: 200 })
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should call service with exact limit when within bounds', async () => {
    mockNotificationService.getNotifications = jest.fn().mockResolvedValue({
      notifications: [],
      hasMore: false,
    });

    await request(app)
      .get('/api/v1/notifications')
      .query({ limit: 30 })
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
      TEST_USER_ID,
      30,
      undefined,
    );
  });

  it('should return hasMore=true and cursor when there are more results', async () => {
    const cursor = Buffer.from('2025-01-01T00:00:00.000Z').toString('base64');
    mockNotificationService.getNotifications = jest.fn().mockResolvedValue({
      notifications: [createNotificationFixture()],
      hasMore: true,
      nextCursor: cursor,
    });

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.cursor).toBe(cursor);
  });
});

describe('GET /api/v1/notifications/unread-count', () => {
  it('should return 200 with unread count', async () => {
    mockNotificationService.getUnreadCount = jest.fn().mockResolvedValue(7);

    const res = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBe(7);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/v1/notifications/unread-count');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/notifications/:id/read', () => {
  it('should return 200 when notification is marked as read', async () => {
    const notifId = 'b4e9f2a0-1234-4abc-8def-000000000001';
    mockNotificationService.markAsRead = jest.fn().mockResolvedValue(true);

    const res = await request(app)
      .put(`/api/v1/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(notifId, TEST_USER_ID);
  });

  it('should return 404 when notification not found', async () => {
    const notifId = 'b4e9f2a0-1234-4abc-8def-000000000002';
    mockNotificationService.markAsRead = jest.fn().mockResolvedValue(false);

    const res = await request(app)
      .put(`/api/v1/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('should return 400 for non-UUID id', async () => {
    const res = await request(app)
      .put('/api/v1/notifications/not-a-uuid/read')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).put(
      '/api/v1/notifications/b4e9f2a0-1234-4abc-8def-000000000003/read',
    );
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/notifications/read-all', () => {
  it('should return 200 with count of marked notifications', async () => {
    mockNotificationService.markAllAsRead = jest.fn().mockResolvedValue(5);

    const res = await request(app)
      .put('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.markedCount).toBe(5);
  });

  it('should return 200 with markedCount=0 when all already read', async () => {
    mockNotificationService.markAllAsRead = jest.fn().mockResolvedValue(0);

    const res = await request(app)
      .put('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${generateToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.markedCount).toBe(0);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).put('/api/v1/notifications/read-all');
    expect(res.status).toBe(401);
  });
});
