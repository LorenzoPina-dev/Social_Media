/**
 * Unit Tests — DeviceTokenService
 */

import { DeviceTokenService } from '../../../src/services/deviceToken.service';
import { DeviceTokenModel } from '../../../src/models/deviceToken.model';
import { createDeviceTokenFixture } from '../../fixtures';

jest.mock('../../../src/models/deviceToken.model');

const MockDeviceTokenModel = DeviceTokenModel as jest.MockedClass<typeof DeviceTokenModel>;

let service: DeviceTokenService;
let mockModel: jest.Mocked<DeviceTokenModel>;

beforeEach(() => {
  jest.clearAllMocks();
  mockModel = new MockDeviceTokenModel() as jest.Mocked<DeviceTokenModel>;
  service = new DeviceTokenService(mockModel);
});

describe('DeviceTokenService', () => {
  describe('register()', () => {
    it('should register a new device token', async () => {
      const fixture = createDeviceTokenFixture({ user_id: 'user-1', platform: 'IOS' });
      mockModel.upsert = jest.fn().mockResolvedValue(fixture);

      const result = await service.register('user-1', 'apns-token-abc', 'IOS');

      expect(mockModel.upsert).toHaveBeenCalledWith('user-1', 'apns-token-abc', 'IOS');
      expect(result.platform).toBe('IOS');
    });

    it('should upsert (update existing) device token for same device', async () => {
      const existing = createDeviceTokenFixture({ user_id: 'user-1' });
      mockModel.upsert = jest.fn().mockResolvedValue(existing);

      await service.register('user-1', existing.token, 'ANDROID');

      expect(mockModel.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('unregister()', () => {
    it('should remove device token and return true', async () => {
      mockModel.deleteByToken = jest.fn().mockResolvedValue(true);

      const result = await service.unregister('user-1', 'some-token');

      expect(result).toBe(true);
      expect(mockModel.deleteByToken).toHaveBeenCalledWith('some-token', 'user-1');
    });

    it('should return false when token does not exist', async () => {
      mockModel.deleteByToken = jest.fn().mockResolvedValue(false);

      const result = await service.unregister('user-1', 'non-existent-token');

      expect(result).toBe(false);
    });
  });

  describe('getUserTokens()', () => {
    it('should return all device tokens for a user', async () => {
      const tokens = [
        createDeviceTokenFixture({ user_id: 'user-1', platform: 'IOS' }),
        createDeviceTokenFixture({ user_id: 'user-1', platform: 'ANDROID' }),
      ];
      mockModel.findByUserId = jest.fn().mockResolvedValue(tokens);

      const result = await service.getUserTokens('user-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty array for user without registered devices', async () => {
      mockModel.findByUserId = jest.fn().mockResolvedValue([]);

      const result = await service.getUserTokens('user-1');

      expect(result).toHaveLength(0);
    });
  });
});
