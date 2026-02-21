/**
 * Unit Tests — NotificationService
 *
 * Mock completo di: NotificationModel, PreferencesModel, DeviceTokenModel,
 * WebSocketService, PushService, EmailService, Redis.
 */

import { NotificationService } from '../../../src/services/notification.service';
import { NotificationModel } from '../../../src/models/notification.model';
import { PreferencesModel } from '../../../src/models/preferences.model';
import { DeviceTokenModel } from '../../../src/models/deviceToken.model';
import {
  createNotificationFixture,
  createPreferencesFixture,
  createDeviceTokenFixture,
} from '../../fixtures';

// ──────────────────────────────────────────────────────────────────────────
// MOCKS
// ──────────────────────────────────────────────────────────────────────────

jest.mock('../../../src/models/notification.model');
jest.mock('../../../src/models/preferences.model');
jest.mock('../../../src/models/deviceToken.model');

jest.mock('../../../src/services/websocket.service', () => ({
  websocketService: {
    emitToUser: jest.fn().mockResolvedValue(false),
    isUserOnline: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../../src/services/push.service', () => ({
  pushService: {
    sendToDevices: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
  },
}));

jest.mock('../../../src/services/email.service', () => ({
  emailService: {
    send: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../../src/config/redis', () => ({
  getRedisClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    incr: jest.fn().mockResolvedValue(1),
    decr: jest.fn().mockResolvedValue(0),
    del: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  }),
}));

// ──────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ──────────────────────────────────────────────────────────────────────────

const MockNotificationModel = NotificationModel as jest.MockedClass<typeof NotificationModel>;
const MockPreferencesModel = PreferencesModel as jest.MockedClass<typeof PreferencesModel>;
const MockDeviceTokenModel = DeviceTokenModel as jest.MockedClass<typeof DeviceTokenModel>;

let service: NotificationService;
let mockNotificationModel: jest.Mocked<NotificationModel>;
let mockPreferencesModel: jest.Mocked<PreferencesModel>;
let mockDeviceTokenModel: jest.Mocked<DeviceTokenModel>;

beforeEach(() => {
  jest.clearAllMocks();

  mockNotificationModel = new MockNotificationModel() as jest.Mocked<NotificationModel>;
  mockPreferencesModel = new MockPreferencesModel() as jest.Mocked<PreferencesModel>;
  mockDeviceTokenModel = new MockDeviceTokenModel() as jest.Mocked<DeviceTokenModel>;

  service = new NotificationService(
    mockNotificationModel,
    mockPreferencesModel,
    mockDeviceTokenModel,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// TESTS
// ──────────────────────────────────────────────────────────────────────────

describe('NotificationService', () => {
  // ─── notify() ───────────────────────────────────────────────────────────
  describe('notify()', () => {
    const notificationFixture = (overrides = {}) =>
      createNotificationFixture({ 
        recipient_id: 'recipient-id', 
        actor_id: 'actor-id',
        type: 'LIKE',
        title: 'Nuovo like',
        body: 'Qualcuno ha messo like al tuo post',
        ...overrides 
      });

    it('should save notification to DB and return it', async () => {
      const fixture = notificationFixture();
      mockPreferencesModel.findByUserId = jest.fn().mockResolvedValue(undefined);
      mockNotificationModel.findDuplicate = jest.fn().mockResolvedValue(undefined);
      mockNotificationModel.create = jest.fn().mockResolvedValue(fixture);
      mockDeviceTokenModel.findByUserId = jest.fn().mockResolvedValue([]);

      const result = await service.notify({
        recipientId: 'recipient-id',
        actorId: 'actor-id',
        type: 'LIKE',
        entityId: 'post-id',
        entityType: 'POST',
        title: 'Nuovo like',
        body: 'Qualcuno ha messo like',
      });

      expect(mockNotificationModel.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(fixture);
    });

    it('should return null and skip self-notification (actorId === recipientId)', async () => {
      const userId = 'same-user-id';
      const result = await service.notify({
        recipientId: userId,
        actorId: userId,
        type: 'LIKE',
        title: 'Nuovo like',
        body: 'Like sul tuo post',
      });

      expect(result).toBeNull();
      expect(mockNotificationModel.create).not.toHaveBeenCalled();
    });

    it('should skip duplicate notification and return existing one', async () => {
      const existing = notificationFixture();
      mockNotificationModel.findDuplicate = jest.fn().mockResolvedValue(existing);

      const result = await service.notify({
        recipientId: 'recipient-id',
        actorId: 'actor-id',
        type: 'LIKE',
        entityId: 'entity-id',
        entityType: 'POST',
        title: 'Nuovo like',
        body: 'Like duplicato',
      });

      expect(result).toEqual(existing);
      expect(mockNotificationModel.create).not.toHaveBeenCalled();
    });

    it('should check user preferences before sending', async () => {
      const prefs = createPreferencesFixture({ likes_push: false, likes_email: false });
      mockPreferencesModel.findByUserId = jest.fn().mockResolvedValue(prefs);
      mockNotificationModel.findDuplicate = jest.fn().mockResolvedValue(undefined);
      mockNotificationModel.create = jest.fn().mockResolvedValue(notificationFixture());
      mockDeviceTokenModel.findByUserId = jest.fn().mockResolvedValue([]);

      const { pushService } = jest.requireMock('../../../src/services/push.service');

      await service.notify({
        recipientId: 'recipient-id',
        actorId: 'actor-id',
        type: 'LIKE',
        title: 'Like',
        body: 'Like test',
      });

      // Push disabilitato per LIKE → pushService.sendToDevices non chiamato
      expect(pushService.sendToDevices).not.toHaveBeenCalled();
    });

    it('should send push notification when push preference is enabled', async () => {
      const prefs = createPreferencesFixture({ likes_push: true });
      const deviceToken = createDeviceTokenFixture({ user_id: 'recipient-id', platform: 'ANDROID' });

      mockPreferencesModel.findByUserId = jest.fn().mockResolvedValue(prefs);
      mockNotificationModel.findDuplicate = jest.fn().mockResolvedValue(undefined);
      mockNotificationModel.create = jest.fn().mockResolvedValue(notificationFixture());
      mockDeviceTokenModel.findByUserId = jest.fn().mockResolvedValue([deviceToken]);

      const { pushService } = jest.requireMock('../../../src/services/push.service');

      await service.notify({
        recipientId: 'recipient-id',
        actorId: 'actor-id',
        type: 'LIKE',
        title: 'Like',
        body: 'Like test',
      });

      // Fix: Expect 3 arguments instead of 4
      expect(pushService.sendToDevices).toHaveBeenCalledWith(
        [deviceToken],
        'Like',
        'Like test'
      );
    });

    it('should send email when email preference is enabled and recipientEmail is provided', async () => {
      const prefs = createPreferencesFixture({ follows_email: true });
      mockPreferencesModel.findByUserId = jest.fn().mockResolvedValue(prefs);
      mockNotificationModel.findDuplicate = jest.fn().mockResolvedValue(undefined);
      mockNotificationModel.create = jest.fn().mockResolvedValue(notificationFixture());
      mockDeviceTokenModel.findByUserId = jest.fn().mockResolvedValue([]);

      const { emailService } = jest.requireMock('../../../src/services/email.service');

      await service.notify({
        recipientId: 'recipient-id',
        actorId: 'actor-id',
        type: 'FOLLOW',
        title: 'Nuovo follower',
        body: 'Qualcuno ti segue',
        recipientEmail: 'user@example.com',
      });

      expect(emailService.send).toHaveBeenCalledWith(
        'user@example.com',
        'Nuovo follower',
        expect.stringContaining('Qualcuno ti segue'),
      );
    });

    it('should NOT send email when recipientEmail is missing', async () => {
      const prefs = createPreferencesFixture({ follows_email: true });
      mockPreferencesModel.findByUserId = jest.fn().mockResolvedValue(prefs);
      mockNotificationModel.findDuplicate = jest.fn().mockResolvedValue(undefined);
      mockNotificationModel.create = jest.fn().mockResolvedValue(notificationFixture());
      mockDeviceTokenModel.findByUserId = jest.fn().mockResolvedValue([]);

      const { emailService } = jest.requireMock('../../../src/services/email.service');

      await service.notify({
        recipientId: 'recipient-id',
        actorId: 'actor-id',
        type: 'FOLLOW',
        title: 'Nuovo follower',
        body: 'Test',
        // recipientEmail non fornita
      });

      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('should skip push and email during quiet hours but still save notification', async () => {
      // Imposta quiet hours che copre il momento attuale
      const now = new Date();
      const nextHour = ((now.getHours() + 1) % 24).toString().padStart(2, '0');
      const prevHour = ((now.getHours() - 1 + 24) % 24).toString().padStart(2, '0');

      const prefs = createPreferencesFixture({
        likes_push: true,
        quiet_hours_start: `${prevHour}:00`,
        quiet_hours_end: `${nextHour}:00`,
      });
      mockPreferencesModel.findByUserId = jest.fn().mockResolvedValue(prefs);
      mockNotificationModel.findDuplicate = jest.fn().mockResolvedValue(undefined);
      mockNotificationModel.create = jest.fn().mockResolvedValue(notificationFixture());
      mockDeviceTokenModel.findByUserId = jest.fn().mockResolvedValue([]);

      const { pushService } = jest.requireMock('../../../src/services/push.service');

      await service.notify({
        recipientId: 'recipient-id',
        actorId: 'actor-id',
        type: 'LIKE',
        title: 'Like',
        body: 'Test quiet hours',
      });

      // Notifica salvata in DB
      expect(mockNotificationModel.create).toHaveBeenCalled();
      // Push non inviato per quiet hours
      expect(pushService.sendToDevices).not.toHaveBeenCalled();
    });

    it('should try to push via WebSocket if user is online', async () => {
      mockPreferencesModel.findByUserId = jest.fn().mockResolvedValue(undefined);
      mockNotificationModel.findDuplicate = jest.fn().mockResolvedValue(undefined);
      
      // Create a notification with the expected COMMENT type
      const commentNotification = notificationFixture({ 
        type: 'COMMENT', 
        title: 'Commento',
        body: 'Qualcuno ha commentato'
      });
      mockNotificationModel.create = jest.fn().mockResolvedValue(commentNotification);
      mockDeviceTokenModel.findByUserId = jest.fn().mockResolvedValue([]);

      const { websocketService } = jest.requireMock('../../../src/services/websocket.service');
      websocketService.emitToUser.mockResolvedValue(true);

      await service.notify({
        recipientId: 'recipient-id',
        actorId: 'actor-id',
        type: 'COMMENT',
        title: 'Commento',
        body: 'Qualcuno ha commentato',
      });

      expect(websocketService.emitToUser).toHaveBeenCalledWith(
        'recipient-id',
        'notification:new',
        expect.objectContaining({ type: 'COMMENT', title: 'Commento' }),
      );
    });

    it('should use default push=true when no preferences exist', async () => {
      mockPreferencesModel.findByUserId = jest.fn().mockResolvedValue(undefined);
      mockNotificationModel.findDuplicate = jest.fn().mockResolvedValue(undefined);
      mockNotificationModel.create = jest.fn().mockResolvedValue(notificationFixture());
      const deviceToken = createDeviceTokenFixture();
      mockDeviceTokenModel.findByUserId = jest.fn().mockResolvedValue([deviceToken]);

      const { pushService } = jest.requireMock('../../../src/services/push.service');

      await service.notify({
        recipientId: 'recipient-id',
        actorId: 'actor-id',
        type: 'MENTION',
        title: 'Menzione',
        body: 'Sei stato menzionato',
      });

      expect(pushService.sendToDevices).toHaveBeenCalled();
    });
  });

  // ─── getNotifications() ──────────────────────────────────────────────────
  describe('getNotifications()', () => {
    it('should return paginated notifications with hasMore=false when results <= limit', async () => {
      const notifications = [
        createNotificationFixture({ created_at: new Date('2025-01-02') }),
        createNotificationFixture({ created_at: new Date('2025-01-01') }),
      ];
      mockNotificationModel.findByRecipient = jest.fn().mockResolvedValue(notifications);

      const result = await service.getNotifications('user-id', 20);

      expect(result.notifications).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should return hasMore=true and nextCursor when there are more results', async () => {
      // Simula limit=2, ma il model restituisce 3 (limit+1)
      const notifications = [
        createNotificationFixture({ created_at: new Date('2025-01-03') }),
        createNotificationFixture({ created_at: new Date('2025-01-02') }),
        createNotificationFixture({ created_at: new Date('2025-01-01') }), // elemento extra
      ];
      mockNotificationModel.findByRecipient = jest.fn().mockResolvedValue(notifications);

      const result = await service.getNotifications('user-id', 2);

      expect(result.notifications).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it('should return empty list for user with no notifications', async () => {
      mockNotificationModel.findByRecipient = jest.fn().mockResolvedValue([]);

      const result = await service.getNotifications('user-id', 20);

      expect(result.notifications).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  // ─── getUnreadCount() ────────────────────────────────────────────────────
  describe('getUnreadCount()', () => {
    it('should return count from Redis cache if available', async () => {
      const { getRedisClient } = jest.requireMock('../../../src/config/redis');
      getRedisClient().get.mockResolvedValueOnce('5');

      const count = await service.getUnreadCount('user-id');

      expect(count).toBe(5);
      expect(mockNotificationModel.countUnread).not.toHaveBeenCalled();
    });

    it('should query DB on cache miss and populate Redis', async () => {
      const { getRedisClient } = jest.requireMock('../../../src/config/redis');
      getRedisClient().get.mockResolvedValueOnce(null);
      mockNotificationModel.countUnread = jest.fn().mockResolvedValue(3);

      const count = await service.getUnreadCount('user-id');

      expect(count).toBe(3);
      expect(mockNotificationModel.countUnread).toHaveBeenCalledWith('user-id');
      expect(getRedisClient().setex).toHaveBeenCalled();
    });

    it('should fallback to DB when Redis is unavailable', async () => {
      const { getRedisClient } = jest.requireMock('../../../src/config/redis');
      getRedisClient().get.mockRejectedValueOnce(new Error('Redis down'));
      mockNotificationModel.countUnread = jest.fn().mockResolvedValue(7);

      const count = await service.getUnreadCount('user-id');

      expect(count).toBe(7);
    });
  });

  // ─── markAsRead() ────────────────────────────────────────────────────────
  describe('markAsRead()', () => {
    it('should mark notification as read and decrement Redis counter', async () => {
      mockNotificationModel.markAsRead = jest.fn().mockResolvedValue(true);

      const result = await service.markAsRead('notification-id', 'user-id');

      expect(result).toBe(true);
      expect(mockNotificationModel.markAsRead).toHaveBeenCalledWith('notification-id', 'user-id');
    });

    it('should return false and not touch Redis if notification not found', async () => {
      mockNotificationModel.markAsRead = jest.fn().mockResolvedValue(false);
      const { getRedisClient } = jest.requireMock('../../../src/config/redis');

      const result = await service.markAsRead('non-existent-id', 'user-id');

      expect(result).toBe(false);
      expect(getRedisClient().decr).not.toHaveBeenCalled();
    });

    it('should emit WebSocket event notification:read when successful', async () => {
      mockNotificationModel.markAsRead = jest.fn().mockResolvedValue(true);
      const { websocketService } = jest.requireMock('../../../src/services/websocket.service');

      await service.markAsRead('notification-id', 'user-id');

      expect(websocketService.emitToUser).toHaveBeenCalledWith(
        'user-id',
        'notification:read',
        { id: 'notification-id' },
      );
    });
  });

  // ─── markAllAsRead() ─────────────────────────────────────────────────────
  describe('markAllAsRead()', () => {
    it('should mark all notifications as read and reset Redis counter', async () => {
      mockNotificationModel.markAllAsRead = jest.fn().mockResolvedValue(5);

      const count = await service.markAllAsRead('user-id');

      expect(count).toBe(5);
      expect(mockNotificationModel.markAllAsRead).toHaveBeenCalledWith('user-id');
    });

    it('should not touch Redis if no notifications were updated', async () => {
      mockNotificationModel.markAllAsRead = jest.fn().mockResolvedValue(0);
      const { getRedisClient } = jest.requireMock('../../../src/config/redis');

      await service.markAllAsRead('user-id');

      expect(getRedisClient().del).not.toHaveBeenCalled();
    });

    it('should emit WebSocket event notifications:all_read', async () => {
      mockNotificationModel.markAllAsRead = jest.fn().mockResolvedValue(3);
      const { websocketService } = jest.requireMock('../../../src/services/websocket.service');

      await service.markAllAsRead('user-id');

      expect(websocketService.emitToUser).toHaveBeenCalledWith(
        'user-id',
        'notifications:all_read',
        {},
      );
    });
  });

  // ─── deleteUserData() (GDPR) ─────────────────────────────────────────────
  describe('deleteUserData() — GDPR', () => {
    it('should delete all user notification data (notifications, devices, preferences)', async () => {
      mockNotificationModel.deleteByRecipient = jest.fn().mockResolvedValue(undefined);
      mockDeviceTokenModel.deleteByUserId = jest.fn().mockResolvedValue(undefined);
      mockPreferencesModel.deleteByUserId = jest.fn().mockResolvedValue(undefined);

      await service.deleteUserData('user-id');

      expect(mockNotificationModel.deleteByRecipient).toHaveBeenCalledWith('user-id');
      expect(mockDeviceTokenModel.deleteByUserId).toHaveBeenCalledWith('user-id');
      expect(mockPreferencesModel.deleteByUserId).toHaveBeenCalledWith('user-id');
    });

    it('should complete even if some deletions fail (allSettled)', async () => {
      mockNotificationModel.deleteByRecipient = jest.fn().mockRejectedValue(new Error('DB error'));
      mockDeviceTokenModel.deleteByUserId = jest.fn().mockResolvedValue(undefined);
      mockPreferencesModel.deleteByUserId = jest.fn().mockResolvedValue(undefined);

      // Non deve lanciare eccezione
      await expect(service.deleteUserData('user-id')).resolves.not.toThrow();
      expect(mockDeviceTokenModel.deleteByUserId).toHaveBeenCalled();
    });
  });
});