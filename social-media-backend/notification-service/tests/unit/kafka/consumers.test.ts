/**
 * Unit Tests — Kafka Consumers (interaction, user, moderation)
 */

import { InteractionConsumer } from '../../../src/kafka/consumers/interaction.consumer';
import { UserEventConsumer } from '../../../src/kafka/consumers/user.consumer';
import { ModerationConsumer } from '../../../src/kafka/consumers/moderation.consumer';
import { NotificationService } from '../../../src/services/notification.service';
import {
  createKafkaLikeEvent,
  createKafkaFollowEvent,
  createKafkaCommentEvent,
} from '../../fixtures';

// ──────────────────────────────────────────────────────────────────────────
// MOCKS
// ──────────────────────────────────────────────────────────────────────────

jest.mock('../../../src/config/kafka', () => ({
  getKafkaConsumer: jest.fn().mockReturnValue({
    subscribe: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockResolvedValue(undefined),
  }),
}));

// ──────────────────────────────────────────────────────────────────────────
// SETUP
// ──────────────────────────────────────────────────────────────────────────

let mockNotificationService: jest.Mocked<NotificationService>;

beforeEach(() => {
  jest.clearAllMocks();
  mockNotificationService = {
    notify: jest.fn().mockResolvedValue(null),
    deleteUserData: jest.fn().mockResolvedValue(undefined),
    getNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  } as unknown as jest.Mocked<NotificationService>;
});

// ──────────────────────────────────────────────────────────────────────────
// INTERACTION CONSUMER
// ──────────────────────────────────────────────────────────────────────────

describe('InteractionConsumer', () => {
  let consumer: InteractionConsumer;

  beforeEach(() => {
    consumer = new InteractionConsumer(mockNotificationService);
  });

  it('should send LIKE notification to post author on like_created', async () => {
    const postAuthorId = 'author-user-id';
    const actorId = 'liker-user-id';
    const event = createKafkaLikeEvent({ userId: actorId, payload: { targetType: 'POST', postAuthorId } });

    // Accesso al metodo privato tramite casting
    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: postAuthorId,
        actorId,
        type: 'LIKE',
        entityType: 'POST',
      }),
    );
  });

  it('should NOT notify when postAuthorId is missing in like_created', async () => {
    const event = createKafkaLikeEvent({
      payload: { targetType: 'POST', postAuthorId: undefined },
    });

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.notify).not.toHaveBeenCalled();
  });

  it('should send COMMENT notification to post author on comment_created', async () => {
    const postAuthorId = 'post-author-id';
    const actorId = 'commenter-id';
    const event = createKafkaCommentEvent({
      userId: actorId,
      payload: { postId: 'post-id', parentId: null, postAuthorId },
    });

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: postAuthorId,
        actorId,
        type: 'COMMENT',
        entityType: 'POST',
      }),
    );
  });

  it('should send COMMENT notification also to parent comment author (different from post author)', async () => {
    const postAuthorId = 'post-author-id';
    const parentAuthorId = 'parent-author-id';
    const actorId = 'commenter-id';
    const event = createKafkaCommentEvent({
      userId: actorId,
      payload: { postId: 'post-id', parentId: 'parent-comment-id', postAuthorId, parentAuthorId },
    });

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    // Deve notificare sia il post author che il parent comment author
    expect(mockNotificationService.notify).toHaveBeenCalledTimes(2);
  });

  it('should NOT send duplicate notification if parentAuthorId === postAuthorId', async () => {
    const sameAuthorId = 'same-author-id';
    const event = createKafkaCommentEvent({
      payload: { postId: 'post-id', parentId: 'parent-id', postAuthorId: sameAuthorId, parentAuthorId: sameAuthorId },
    });

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    // Solo una notifica (non duplicata)
    expect(mockNotificationService.notify).toHaveBeenCalledTimes(1);
  });

  it('should send SHARE notification to post author on share_created', async () => {
    const postAuthorId = 'share-post-author-id';
    const actorId = 'sharer-id';
    const event = {
      type: 'share_created',
      entityId: 'post-id',
      userId: actorId,
      timestamp: new Date().toISOString(),
      payload: { postAuthorId },
    };

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: postAuthorId,
        actorId,
        type: 'SHARE',
        entityType: 'POST',
      }),
    );
  });

  it('should ignore unknown event types', async () => {
    const event = { type: 'unknown_event', entityId: 'id', userId: 'user', timestamp: '' };

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.notify).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// USER EVENT CONSUMER
// ──────────────────────────────────────────────────────────────────────────

describe('UserEventConsumer', () => {
  let consumer: UserEventConsumer;

  beforeEach(() => {
    consumer = new UserEventConsumer(mockNotificationService);
  });

  it('should send FOLLOW notification to followed user on follow_created', async () => {
    const followingId = 'followed-user-id';
    const followerId = 'follower-user-id';
    const event = createKafkaFollowEvent({ userId: followerId, payload: { followingId } });

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: followingId,
        actorId: followerId,
        type: 'FOLLOW',
        entityType: 'USER',
      }),
    );
  });

  it('should NOT notify when followingId is missing', async () => {
    const event = createKafkaFollowEvent({ payload: { followingId: undefined } });

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.notify).not.toHaveBeenCalled();
  });

  it('should delete user data on user_deleted (GDPR)', async () => {
    const userId = 'deleted-user-id';
    const event = { type: 'user_deleted', entityId: userId, userId, timestamp: '' };

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.deleteUserData).toHaveBeenCalledWith(userId);
    expect(mockNotificationService.notify).not.toHaveBeenCalled();
  });

  it('should ignore user_updated events', async () => {
    const event = {
      type: 'user_updated',
      entityId: 'user-id',
      userId: 'user-id',
      timestamp: '',
      payload: { changedFields: ['bio'] },
    };

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.notify).not.toHaveBeenCalled();
    expect(mockNotificationService.deleteUserData).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// MODERATION CONSUMER
// ──────────────────────────────────────────────────────────────────────────

describe('ModerationConsumer', () => {
  let consumer: ModerationConsumer;

  beforeEach(() => {
    consumer = new ModerationConsumer(mockNotificationService);
  });

  it('should send SYSTEM notification on content_rejected', async () => {
    const ownerId = 'content-owner-id';
    const event = {
      type: 'content_rejected',
      entityId: 'post-id',
      userId: ownerId,
      timestamp: '',
      payload: { entityType: 'POST', reason: 'Contenuto inappropriato', ownerId },
    };

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: ownerId,
        type: 'SYSTEM',
        entityId: 'post-id',
        entityType: 'POST',
        title: 'Contenuto rimosso',
      }),
    );
  });

  it('should use userId as fallback when ownerId is missing in content_rejected', async () => {
    const userId = 'fallback-user-id';
    const event = {
      type: 'content_rejected',
      entityId: 'post-id',
      userId,
      timestamp: '',
      payload: { entityType: 'POST', reason: 'spam' },
    };

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: userId }),
    );
  });

  it('should send SYSTEM notification on content_approved', async () => {
    const ownerId = 'approved-content-owner-id';
    const event = {
      type: 'content_approved',
      entityId: 'post-id',
      userId: ownerId,
      timestamp: '',
      payload: { entityType: 'POST', ownerId },
    };

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: ownerId,
        type: 'SYSTEM',
        title: 'Contenuto approvato',
      }),
    );
  });

  it('should NOT notify when ownerId is completely missing', async () => {
    const event = {
      type: 'content_rejected',
      entityId: 'post-id',
      userId: '',
      timestamp: '',
      payload: {},
    };

    await (consumer as unknown as { handle: (e: unknown) => Promise<void> }).handle(event);

    expect(mockNotificationService.notify).not.toHaveBeenCalled();
  });
});
