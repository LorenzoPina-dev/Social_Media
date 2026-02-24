/**
 * Unit Tests — UserEventHandler (Kafka Consumer)
 * Mock: IndexerService, AutocompleteService, logger
 */

import { UserEventHandler } from '../../../src/kafka/consumers/user.consumer';
import {
  createUserRegisteredEvent,
  createUserUpdatedEvent,
  createUserDeletedEvent,
} from '../../fixtures';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/utils/metrics', () => ({
  metrics: { recordIndexingOperation: jest.fn() },
}));

// Mock Elasticsearch service so IndexerService doesn't need real ES
jest.mock('../../../src/services/elasticsearch.service');
jest.mock('../../../src/services/trending.service');

// Spy on the actual methods of IndexerService and AutocompleteService
const mockIndexUser       = jest.fn().mockResolvedValue(undefined);
const mockUpdateUser      = jest.fn().mockResolvedValue(undefined);
const mockDeleteUser      = jest.fn().mockResolvedValue(undefined);
const mockInvalidateCache = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../src/services/indexer.service', () => ({
  IndexerService: jest.fn().mockImplementation(() => ({
    indexUser:  mockIndexUser,
    updateUser: mockUpdateUser,
    deleteUser: mockDeleteUser,
  })),
}));

jest.mock('../../../src/services/autocomplete.service', () => ({
  AutocompleteService: jest.fn().mockImplementation(() => ({
    suggest:         jest.fn(),
    invalidateCache: mockInvalidateCache,
  })),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UserEventHandler', () => {
  let handler: UserEventHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new UserEventHandler();
  });

  describe('handle — user_registered', () => {
    it('should call indexUser when user_registered event received', async () => {
      const event = createUserRegisteredEvent({ entityId: 'user-001' });

      await handler.handle(event);

      expect(mockIndexUser).toHaveBeenCalledTimes(1);
      expect(mockIndexUser).toHaveBeenCalledWith(event);
    });

    it('should NOT throw when indexUser fails (fault-tolerant)', async () => {
      mockIndexUser.mockRejectedValueOnce(new Error('ES down'));
      const event = createUserRegisteredEvent();

      await expect(handler.handle(event)).resolves.not.toThrow();
    });
  });

  describe('handle — user_updated', () => {
    it('should call updateUser when user_updated event received', async () => {
      const event = createUserUpdatedEvent({ payload: { display_name: 'New', changedFields: ['display_name'] } });

      await handler.handle(event);

      expect(mockUpdateUser).toHaveBeenCalledTimes(1);
      expect(mockUpdateUser).toHaveBeenCalledWith(event);
    });

    it('should invalidate autocomplete cache when username changes', async () => {
      const event = createUserUpdatedEvent({
        payload: { username: 'new_username', changedFields: ['username'] },
      });

      await handler.handle(event);

      expect(mockInvalidateCache).toHaveBeenCalledWith('new_username');
    });

    it('should NOT invalidate cache when username did not change', async () => {
      const event = createUserUpdatedEvent({
        payload: { display_name: 'New Display', changedFields: ['display_name'] },
      });

      await handler.handle(event);

      expect(mockInvalidateCache).not.toHaveBeenCalled();
    });

    it('should NOT throw when updateUser fails', async () => {
      mockUpdateUser.mockRejectedValueOnce(new Error('ES timeout'));
      const event = createUserUpdatedEvent();

      await expect(handler.handle(event)).resolves.not.toThrow();
    });
  });

  describe('handle — user_deleted', () => {
    it('should call deleteUser when user_deleted event received', async () => {
      const event = createUserDeletedEvent('user-999');

      await handler.handle(event);

      expect(mockDeleteUser).toHaveBeenCalledWith('user-999');
    });

    it('should NOT throw when deleteUser fails', async () => {
      mockDeleteUser.mockRejectedValueOnce(new Error('Not found'));
      const event = createUserDeletedEvent('user-000');

      await expect(handler.handle(event)).resolves.not.toThrow();
    });
  });

  describe('handle — unknown event type', () => {
    it('should NOT throw for unknown event types', async () => {
      const unknownEvent = {
        type:      'user_banned' as any,
        entityId:  'user-xxx',
        userId:    'user-xxx',
        timestamp: new Date().toISOString(),
      };

      await expect(handler.handle(unknownEvent)).resolves.not.toThrow();
      expect(mockIndexUser).not.toHaveBeenCalled();
      expect(mockUpdateUser).not.toHaveBeenCalled();
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });
  });
});
