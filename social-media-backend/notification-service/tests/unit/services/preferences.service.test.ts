/**
 * Unit Tests — PreferencesService
 */

import { PreferencesService } from '../../../src/services/preferences.service';
import { PreferencesModel } from '../../../src/models/preferences.model';
import { createPreferencesFixture } from '../../fixtures';

jest.mock('../../../src/models/preferences.model');

const MockPreferencesModel = PreferencesModel as jest.MockedClass<typeof PreferencesModel>;

let service: PreferencesService;
let mockModel: jest.Mocked<PreferencesModel>;

beforeEach(() => {
  jest.clearAllMocks();
  mockModel = new MockPreferencesModel() as jest.Mocked<PreferencesModel>;
  service = new PreferencesService(mockModel);
});

describe('PreferencesService', () => {
  describe('get()', () => {
    it('should return existing preferences from DB', async () => {
      const prefs = createPreferencesFixture({ user_id: 'user-1' });
      mockModel.findByUserId = jest.fn().mockResolvedValue(prefs);

      const result = await service.get('user-1');

      expect(result).toEqual(prefs);
      expect(mockModel.upsert).not.toHaveBeenCalled();
    });

    it('should create default preferences when none exist', async () => {
      const defaultPrefs = createPreferencesFixture({ user_id: 'user-1' });
      mockModel.findByUserId = jest.fn().mockResolvedValue(undefined);
      mockModel.upsert = jest.fn().mockResolvedValue(defaultPrefs);

      const result = await service.get('user-1');

      expect(mockModel.upsert).toHaveBeenCalledWith('user-1', {});
      expect(result).toEqual(defaultPrefs);
    });
  });

  describe('update()', () => {
    it('should update preferences and return updated values', async () => {
      const updated = createPreferencesFixture({ likes_push: false });
      mockModel.upsert = jest.fn().mockResolvedValue(updated);

      const result = await service.update('user-1', { likes_push: false });

      expect(mockModel.upsert).toHaveBeenCalledWith('user-1', { likes_push: false });
      expect(result.likes_push).toBe(false);
    });
  });
});
