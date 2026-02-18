/**
 * GDPRService — Unit Tests
 *
 * Dipendenze mockate: UserService, FollowerService, UserProducer.
 * La logica testata è quella reale di gdpr.service.ts.
 */

// ── mock prima di qualsiasi import ────────────────────────────────────────
jest.mock('../../../src/config/database', () => ({ getDatabase: jest.fn(), connectDatabase: jest.fn() }));
jest.mock('../../../src/config/redis',    () => ({ getRedisClient: jest.fn().mockReturnValue({
  get: jest.fn(), set: jest.fn(), setex: jest.fn(), del: jest.fn(), ping: jest.fn(),
}) }));
jest.mock('../../../src/config/kafka',    () => ({ getKafkaProducer: jest.fn(), connectKafka: jest.fn() }));
jest.mock('../../../src/utils/logger',    () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../../../src/utils/metrics',   () => ({
  metrics: { incrementCounter: jest.fn() },
  userMetrics: { requestDuration: { observe: jest.fn() } },
  default: { incrementCounter: jest.fn() },
}));
jest.mock('../../../src/services/user.service');
jest.mock('../../../src/services/follower.service');
jest.mock('../../../src/kafka/producers/user.producer');

import { GDPRService }     from '../../../src/services/gdpr.service';
import { UserService }     from '../../../src/services/user.service';
import { FollowerService } from '../../../src/services/follower.service';
import { UserProducer }    from '../../../src/kafka/producers/user.producer';
import { User }            from '../../../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVE_USER: User = {
  id:             'uid-gdpr-001',
  username:       'gdpruser',
  email:          'gdpr@example.com',
  display_name:   'GDPR User',
  verified:       true,
  follower_count: 5,
  following_count: 3,
  status:         'ACTIVE',
  created_at:     new Date('2024-01-01'),
  updated_at:     new Date('2024-01-01'),
};

const PENDING_USER: User = {
  ...ACTIVE_USER,
  status:     'PENDING_DELETION',
  deleted_at: new Date('2024-06-01'),
};

const FOLLOWERS  = [{ ...ACTIVE_USER, id: 'f1' }];
const FOLLOWING  = [{ ...ACTIVE_USER, id: 'g1' }, { ...ACTIVE_USER, id: 'g2' }];

// ─────────────────────────────────────────────────────────────────────────────

describe('GDPRService', () => {
  let service: GDPRService;
  let userService: jest.Mocked<UserService>;
  let followerService: jest.Mocked<FollowerService>;
  let userProducer: jest.Mocked<UserProducer>;

  beforeEach(() => {
    jest.clearAllMocks();

    userService     = new UserService(null as any, null as any, null as any) as jest.Mocked<UserService>;
    followerService = new FollowerService(null as any, null as any, null as any, null as any) as jest.Mocked<FollowerService>;
    userProducer    = new UserProducer() as jest.Mocked<UserProducer>;

    service = new GDPRService(userService, followerService, userProducer);

    // Default publish stubs
    userProducer.publishDataExported.mockResolvedValue(undefined);
    userProducer.publishDeletionCancelled.mockResolvedValue(undefined);
    userProducer.publishUserPermanentlyDeleted.mockResolvedValue(undefined);
    userProducer.publishUserAnonymized.mockResolvedValue(undefined);
    userProducer.publishUserDeletionRequested.mockResolvedValue(undefined);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('exportUserData', () => {
    beforeEach(() => {
      userService.findById.mockResolvedValue(ACTIVE_USER);
      followerService.getFollowers.mockResolvedValue(FOLLOWERS);
      followerService.getFollowing.mockResolvedValue(FOLLOWING);
    });

    it('restituisce user, followers, following e exportDate', async () => {
      const result = await service.exportUserData(ACTIVE_USER.id);

      expect(result.user).toEqual(ACTIVE_USER);
      expect(result.followers).toEqual(FOLLOWERS);
      expect(result.following).toEqual(FOLLOWING);
      expect(result.exportDate).toBeInstanceOf(Date);
      expect(result.format).toBe('json');
    });

    it('chiama getFollowers e getFollowing con limite alto (export completo)', async () => {
      await service.exportUserData(ACTIVE_USER.id);

      expect(followerService.getFollowers).toHaveBeenCalledWith(
        ACTIVE_USER.id, { limit: 10000 },
      );
      expect(followerService.getFollowing).toHaveBeenCalledWith(
        ACTIVE_USER.id, { limit: 10000 },
      );
    });

    it('pubblica l\'evento data_exported', async () => {
      await service.exportUserData(ACTIVE_USER.id);

      expect(userProducer.publishDataExported).toHaveBeenCalledWith(
        expect.objectContaining({ userId: ACTIVE_USER.id }),
      );
    });

    it('lancia errore se l\'utente non esiste', async () => {
      userService.findById.mockResolvedValue(null);

      await expect(service.exportUserData(ACTIVE_USER.id)).rejects.toThrow('User not found');
      expect(followerService.getFollowers).not.toHaveBeenCalled();
    });

    it('la exportDate è prossima alla data corrente', async () => {
      const before = new Date();
      const result = await service.exportUserData(ACTIVE_USER.id);
      const after  = new Date();

      expect(result.exportDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.exportDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('requestDeletion', () => {
    beforeEach(() => {
      userService.softDelete.mockResolvedValue(undefined);
    });

    it('esegue soft delete dell\'utente', async () => {
      await service.requestDeletion(ACTIVE_USER.id);

      expect(userService.softDelete).toHaveBeenCalledWith(ACTIVE_USER.id);
    });

    it('pubblica l\'evento user_deletion_requested', async () => {
      await service.requestDeletion(ACTIVE_USER.id);

      expect(userProducer.publishUserDeletionRequested).toHaveBeenCalledWith(
        expect.objectContaining({
          userId:          ACTIVE_USER.id,
          gracePeriodDays: 30,
        }),
      );
    });

    it('la scheduledDeletionAt è circa 30 giorni nel futuro', async () => {
      const before = Date.now();
      await service.requestDeletion(ACTIVE_USER.id);
      const after  = Date.now();

      const call = userProducer.publishUserDeletionRequested.mock.calls[0][0] as any;
      const scheduledMs = call.scheduledDeletionAt.getTime();
      const thirtyDaysMs = 30 * 24 * 3600 * 1000;

      expect(scheduledMs).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000);
      expect(scheduledMs).toBeLessThanOrEqual(after  + thirtyDaysMs + 1000);
    });

    it('rilancia l\'errore se softDelete fallisce', async () => {
      userService.softDelete.mockRejectedValue(new Error('DB error'));
      await expect(service.requestDeletion(ACTIVE_USER.id)).rejects.toThrow('DB error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('cancelDeletion', () => {
    beforeEach(() => {
      userService.findById.mockResolvedValue(PENDING_USER);
      userService.update.mockResolvedValue({ ...ACTIVE_USER, status: 'ACTIVE' });
    });

    it('aggiorna lo stato dell\'utente tramite userService.update', async () => {
      await service.cancelDeletion(ACTIVE_USER.id);

      expect(userService.update).toHaveBeenCalledWith(
        ACTIVE_USER.id,
        expect.any(Object),
      );
    });

    it('pubblica l\'evento deletion_cancelled', async () => {
      await service.cancelDeletion(ACTIVE_USER.id);

      expect(userProducer.publishDeletionCancelled).toHaveBeenCalledWith(
        expect.objectContaining({ userId: ACTIVE_USER.id }),
      );
    });

    it('lancia errore se l\'utente non esiste', async () => {
      userService.findById.mockResolvedValue(null);
      await expect(service.cancelDeletion(ACTIVE_USER.id)).rejects.toThrow('User not found');
    });

    it('lancia errore se non c\'è una richiesta di cancellazione attiva', async () => {
      userService.findById.mockResolvedValue(ACTIVE_USER); // status ACTIVE, non PENDING_DELETION

      await expect(service.cancelDeletion(ACTIVE_USER.id)).rejects.toThrow('No deletion request found');
      expect(userService.update).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('getDataStatus', () => {
    it('restituisce status ACTIVE senza deletionScheduled', async () => {
      userService.findById.mockResolvedValue(ACTIVE_USER);

      const status = await service.getDataStatus(ACTIVE_USER.id);

      expect(status.userId).toBe(ACTIVE_USER.id);
      expect(status.status).toBe('ACTIVE');
      expect(status.deletionScheduled).toBe(false);
      expect(status.deletionDate).toBeUndefined();
    });

    it('restituisce deletionScheduled:true per utente PENDING_DELETION', async () => {
      userService.findById.mockResolvedValue(PENDING_USER);

      const status = await service.getDataStatus(ACTIVE_USER.id);

      expect(status.deletionScheduled).toBe(true);
    });

    it('calcola deletionDate come deleted_at + 30 giorni', async () => {
      userService.findById.mockResolvedValue(PENDING_USER);

      const status = await service.getDataStatus(ACTIVE_USER.id);

      const expected = new Date(PENDING_USER.deleted_at!);
      // gdpr service aggiunge SOFT_DELETE_GRACE_PERIOD (2592000 s = 30 giorni)
      expected.setSeconds(expected.getSeconds() + 2592000);

      expect(status.deletionDate!.getTime()).toBeCloseTo(expected.getTime(), -3);
    });

    it('include le politiche di data retention', async () => {
      userService.findById.mockResolvedValue(ACTIVE_USER);

      const status = await service.getDataStatus(ACTIVE_USER.id);

      expect(status.dataRetention).toHaveProperty('profiles');
      expect(status.dataRetention).toHaveProperty('followers');
      expect(status.dataRetention).toHaveProperty('posts');
    });

    it('lancia errore se l\'utente non esiste', async () => {
      userService.findById.mockResolvedValue(null);
      await expect(service.getDataStatus('nonexistent')).rejects.toThrow('User not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('permanentlyDeleteUser', () => {
    beforeEach(() => {
      followerService.removeAllFollowers.mockResolvedValue(undefined);
      userService.hardDelete.mockResolvedValue(undefined);
    });

    it('rimuove tutti i followers prima dell\'eliminazione', async () => {
      await service.permanentlyDeleteUser(ACTIVE_USER.id);

      expect(followerService.removeAllFollowers).toHaveBeenCalledWith(ACTIVE_USER.id);
    });

    it('esegue hard delete dell\'utente', async () => {
      await service.permanentlyDeleteUser(ACTIVE_USER.id);

      expect(userService.hardDelete).toHaveBeenCalledWith(ACTIVE_USER.id);
    });

    it('pubblica l\'evento user_permanently_deleted', async () => {
      await service.permanentlyDeleteUser(ACTIVE_USER.id);

      expect(userProducer.publishUserPermanentlyDeleted).toHaveBeenCalledWith(
        expect.objectContaining({ userId: ACTIVE_USER.id }),
      );
    });

    it('l\'ordine è: removeAllFollowers → hardDelete → publish', async () => {
      const order: string[] = [];
      followerService.removeAllFollowers.mockImplementation(async () => { order.push('removeAll'); });
      userService.hardDelete.mockImplementation(async () => { order.push('hardDelete'); });
      userProducer.publishUserPermanentlyDeleted.mockImplementation(async () => { order.push('publish'); });

      await service.permanentlyDeleteUser(ACTIVE_USER.id);

      expect(order).toEqual(['removeAll', 'hardDelete', 'publish']);
    });

    it('rilancia l\'errore se hardDelete fallisce', async () => {
      userService.hardDelete.mockRejectedValue(new Error('DB error'));
      await expect(service.permanentlyDeleteUser(ACTIVE_USER.id)).rejects.toThrow('DB error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('anonymizeUser', () => {
    beforeEach(() => {
      userService.update.mockResolvedValue({
        ...ACTIVE_USER, display_name: 'Deleted User', bio: undefined, avatar_url: undefined,
      });
    });

    it('aggiorna l\'utente con dati anonimizzati', async () => {
      await service.anonymizeUser(ACTIVE_USER.id);

      expect(userService.update).toHaveBeenCalledWith(
        ACTIVE_USER.id,
        expect.objectContaining({ display_name: 'Deleted User' }),
      );
    });

    it('imposta bio e avatar_url a undefined', async () => {
      await service.anonymizeUser(ACTIVE_USER.id);

      const updateArg = userService.update.mock.calls[0][1] as any;
      expect(updateArg.bio).toBeUndefined();
      expect(updateArg.avatar_url).toBeUndefined();
    });

    it('pubblica l\'evento user_anonymized', async () => {
      await service.anonymizeUser(ACTIVE_USER.id);

      expect(userProducer.publishUserAnonymized).toHaveBeenCalledWith(
        expect.objectContaining({ userId: ACTIVE_USER.id }),
      );
    });

    it('rilancia l\'errore se update fallisce', async () => {
      userService.update.mockRejectedValue(new Error('Update failed'));
      await expect(service.anonymizeUser(ACTIVE_USER.id)).rejects.toThrow('Update failed');
    });
  });
});
