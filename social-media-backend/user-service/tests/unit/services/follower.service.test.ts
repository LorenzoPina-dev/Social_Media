/**
 * FollowerService — Unit Tests
 *
 * Dipendenze mockate: FollowerModel, UserService, CacheService, UserProducer.
 * La logica testata è quella reale di follower.service.ts.
 */

// ── mock prima di qualsiasi import ────────────────────────────────────────
jest.mock('../../../src/config/database', () => ({ getDatabase: jest.fn(), connectDatabase: jest.fn() }));
jest.mock('../../../src/config/redis',    () => ({ getRedisClient: jest.fn().mockReturnValue({
  get: jest.fn(), set: jest.fn(), setex: jest.fn(), del: jest.fn(), ping: jest.fn(),
}) }));
jest.mock('../../../src/config/kafka',    () => ({ getKafkaProducer: jest.fn(), connectKafka: jest.fn() }));
jest.mock('../../../src/utils/logger',    () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../../../src/utils/metrics',   () => ({
  metrics: { incrementCounter: jest.fn(), recordRequestDuration: jest.fn() },
  userMetrics: { userFollowed: { inc: jest.fn() }, userUnfollowed: { inc: jest.fn() }, requestDuration: { observe: jest.fn() } },
  default: { incrementCounter: jest.fn() },
}));
jest.mock('../../../src/models/follower.model');
jest.mock('../../../src/services/user.service');
jest.mock('../../../src/services/cache.service');
jest.mock('../../../src/kafka/producers/user.producer');

import { FollowerService } from '../../../src/services/follower.service';
import { FollowerModel }   from '../../../src/models/follower.model';
import { UserService }     from '../../../src/services/user.service';
import { CacheService }    from '../../../src/services/cache.service';
import { UserProducer }    from '../../../src/kafka/producers/user.producer';
import { User }            from '../../../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────
const mkUser = (id: string, extra: Partial<User> = {}): User => ({
  id,
  username:        `user_${id}`,
  email:           `${id}@example.com`,
  display_name:    `User ${id}`,
  verified:        true,
  follower_count:  10,
  following_count: 5,
  status:          'ACTIVE',
  created_at:      new Date(),
  updated_at:      new Date(),
  ...extra,
});

const FOLLOWER_ID  = 'uid-follower';
const FOLLOWING_ID = 'uid-following';

//const FOLLOWER_USER  = mkUser(FOLLOWER_ID,  { following_count: 5 });
const FOLLOWING_USER = mkUser(FOLLOWING_ID, { follower_count: 10 });

// ─────────────────────────────────────────────────────────────────────────────

describe('FollowerService', () => {
  let service: FollowerService;
  let followerModel: jest.Mocked<FollowerModel>;
  let userService: jest.Mocked<UserService>;
  let cacheService: jest.Mocked<CacheService>;
  let userProducer: jest.Mocked<UserProducer>;

  beforeEach(() => {
    jest.clearAllMocks();

    followerModel = new FollowerModel() as jest.Mocked<FollowerModel>;
    userService   = new UserService(null as any, null as any, null as any) as jest.Mocked<UserService>;
    cacheService  = new CacheService() as jest.Mocked<CacheService>;
    userProducer  = new UserProducer() as jest.Mocked<UserProducer>;

    service = new FollowerService(followerModel, userService, cacheService, userProducer);

    // Default happy-path stubs
    userProducer.publishUserFollowed.mockResolvedValue(undefined);
    userProducer.publishUserUnfollowed.mockResolvedValue(undefined);
    cacheService.invalidateFollowers.mockResolvedValue(undefined);
    cacheService.get.mockResolvedValue(null);
    cacheService.set.mockResolvedValue(undefined);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('follow', () => {
    beforeEach(() => {
      userService.findById.mockResolvedValue(FOLLOWING_USER);
      followerModel.isFollowing.mockResolvedValue(false);
      followerModel.create.mockResolvedValue({
        id: 'rel-001', follower_id: FOLLOWER_ID, following_id: FOLLOWING_ID, created_at: new Date(),
      });
      userService.incrementFollowerCount.mockResolvedValue(undefined);
      userService.incrementFollowingCount.mockResolvedValue(undefined);
    });

    it('crea la relazione di follow', async () => {
      await service.follow(FOLLOWER_ID, FOLLOWING_ID);
      expect(followerModel.create).toHaveBeenCalledWith(FOLLOWER_ID, FOLLOWING_ID);
    });

    it('incrementa follower_count dell\'utente seguito', async () => {
      await service.follow(FOLLOWER_ID, FOLLOWING_ID);
      expect(userService.incrementFollowerCount).toHaveBeenCalledWith(FOLLOWING_ID);
    });

    it('incrementa following_count di chi segue', async () => {
      await service.follow(FOLLOWER_ID, FOLLOWING_ID);
      expect(userService.incrementFollowingCount).toHaveBeenCalledWith(FOLLOWER_ID);
    });

    it('invalida la cache dei followers di entrambi gli utenti', async () => {
      await service.follow(FOLLOWER_ID, FOLLOWING_ID);
      expect(cacheService.invalidateFollowers).toHaveBeenCalledWith(FOLLOWER_ID);
      expect(cacheService.invalidateFollowers).toHaveBeenCalledWith(FOLLOWING_ID);
    });

    it('pubblica l\'evento user_followed', async () => {
      await service.follow(FOLLOWER_ID, FOLLOWING_ID);
      expect(userProducer.publishUserFollowed).toHaveBeenCalledWith(
        expect.objectContaining({ followerId: FOLLOWER_ID, followingId: FOLLOWING_ID }),
      );
    });

    it('lancia errore se l\'utente da seguire non esiste', async () => {
      userService.findById.mockResolvedValue(null);
      await expect(service.follow(FOLLOWER_ID, FOLLOWING_ID)).rejects.toThrow('User not found');
      expect(followerModel.create).not.toHaveBeenCalled();
    });

    it('lancia errore se già si segue l\'utente', async () => {
      followerModel.isFollowing.mockResolvedValue(true);
      await expect(service.follow(FOLLOWER_ID, FOLLOWING_ID)).rejects.toThrow('Already following');
      expect(followerModel.create).not.toHaveBeenCalled();
    });

    it('non incrementa i contatori se il follow fallisce', async () => {
      followerModel.create.mockRejectedValue(new Error('DB error'));
      await expect(service.follow(FOLLOWER_ID, FOLLOWING_ID)).rejects.toThrow('DB error');
      expect(userService.incrementFollowerCount).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('unfollow', () => {
    beforeEach(() => {
      followerModel.isFollowing.mockResolvedValue(true);
      followerModel.delete.mockResolvedValue(undefined);
      userService.decrementFollowerCount.mockResolvedValue(undefined);
      userService.decrementFollowingCount.mockResolvedValue(undefined);
    });

    it('elimina la relazione di follow', async () => {
      await service.unfollow(FOLLOWER_ID, FOLLOWING_ID);
      expect(followerModel.delete).toHaveBeenCalledWith(FOLLOWER_ID, FOLLOWING_ID);
    });

    it('decrementa follower_count dell\'utente de-seguito', async () => {
      await service.unfollow(FOLLOWER_ID, FOLLOWING_ID);
      expect(userService.decrementFollowerCount).toHaveBeenCalledWith(FOLLOWING_ID);
    });

    it('decrementa following_count di chi de-segue', async () => {
      await service.unfollow(FOLLOWER_ID, FOLLOWING_ID);
      expect(userService.decrementFollowingCount).toHaveBeenCalledWith(FOLLOWER_ID);
    });

    it('invalida la cache dei followers di entrambi', async () => {
      await service.unfollow(FOLLOWER_ID, FOLLOWING_ID);
      expect(cacheService.invalidateFollowers).toHaveBeenCalledWith(FOLLOWER_ID);
      expect(cacheService.invalidateFollowers).toHaveBeenCalledWith(FOLLOWING_ID);
    });

    it('pubblica l\'evento user_unfollowed', async () => {
      await service.unfollow(FOLLOWER_ID, FOLLOWING_ID);
      expect(userProducer.publishUserUnfollowed).toHaveBeenCalledWith(
        expect.objectContaining({ followerId: FOLLOWER_ID, followingId: FOLLOWING_ID }),
      );
    });

    it('lancia errore se non si sta seguendo l\'utente', async () => {
      followerModel.isFollowing.mockResolvedValue(false);
      await expect(service.unfollow(FOLLOWER_ID, FOLLOWING_ID)).rejects.toThrow('Not following');
      expect(followerModel.delete).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('getFollowers', () => {
    const FOLLOWERS = [mkUser('f1'), mkUser('f2')];

    it('restituisce risultati dalla cache se disponibili', async () => {
      cacheService.get.mockResolvedValue(JSON.stringify(FOLLOWERS));

      const result = (await service.getFollowers(FOLLOWING_ID)).map(u => ({
        ...u,
        created_at: new Date(u.created_at),
        updated_at: new Date(u.updated_at),
      }));

      expect(result).toEqual(FOLLOWERS);
      expect(followerModel.getFollowers).not.toHaveBeenCalled();
    });

    it('recupera da DB se cache miss e salva i risultati', async () => {
      cacheService.get.mockResolvedValue(null);
      followerModel.getFollowers.mockResolvedValue(['f1', 'f2']);
      userService.findByIds.mockResolvedValue(FOLLOWERS);

      const result = await service.getFollowers(FOLLOWING_ID);

      expect(result).toEqual(FOLLOWERS);
      expect(followerModel.getFollowers).toHaveBeenCalledWith(FOLLOWING_ID, {});
      expect(userService.findByIds).toHaveBeenCalledWith(['f1', 'f2']);
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('restituisce array vuoto se non ci sono followers', async () => {
      cacheService.get.mockResolvedValue(null);
      followerModel.getFollowers.mockResolvedValue([]);

      const result = await service.getFollowers(FOLLOWING_ID);

      expect(result).toEqual([]);
      expect(userService.findByIds).not.toHaveBeenCalled();
    });

    it('passa limit e offset al modello', async () => {
      cacheService.get.mockResolvedValue(null);
      followerModel.getFollowers.mockResolvedValue([]);

      await service.getFollowers(FOLLOWING_ID, { limit: 5, offset: 10 });

      expect(followerModel.getFollowers).toHaveBeenCalledWith(
        FOLLOWING_ID, { limit: 5, offset: 10 },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('getFollowing', () => {
    const FOLLOWING_USERS = [mkUser('g1'), mkUser('g2')];

    it('restituisce risultati dalla cache se disponibili', async () => {
      cacheService.get.mockResolvedValue(JSON.stringify(FOLLOWING_USERS));

      const result = (await service.getFollowing(FOLLOWER_ID)).map(u => ({
        ...u,
        created_at: new Date(u.created_at),
        updated_at: new Date(u.updated_at),
      }));
      expect(result).toEqual(FOLLOWING_USERS);
      expect(followerModel.getFollowing).not.toHaveBeenCalled();
    });

    it('recupera da DB se cache miss', async () => {
      cacheService.get.mockResolvedValue(null);
      followerModel.getFollowing.mockResolvedValue(['g1', 'g2']);
      userService.findByIds.mockResolvedValue(FOLLOWING_USERS);

      const result = await service.getFollowing(FOLLOWER_ID);

      expect(result).toEqual(FOLLOWING_USERS);
      expect(followerModel.getFollowing).toHaveBeenCalledWith(FOLLOWER_ID, {});
    });

    it('restituisce array vuoto se non si segue nessuno', async () => {
      cacheService.get.mockResolvedValue(null);
      followerModel.getFollowing.mockResolvedValue([]);

      const result = await service.getFollowing(FOLLOWER_ID);
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('isFollowing', () => {
    it('restituisce true se l\'utente sta seguendo', async () => {
      followerModel.isFollowing.mockResolvedValue(true);

      const result = await service.isFollowing(FOLLOWER_ID, FOLLOWING_ID);

      expect(result).toBe(true);
      expect(followerModel.isFollowing).toHaveBeenCalledWith(FOLLOWER_ID, FOLLOWING_ID);
    });

    it('restituisce false se non sta seguendo', async () => {
      followerModel.isFollowing.mockResolvedValue(false);

      const result = await service.isFollowing(FOLLOWER_ID, FOLLOWING_ID);
      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('getStats', () => {
    it('restituisce followerCount e followingCount dell\'utente', async () => {
      userService.findById.mockResolvedValue(FOLLOWING_USER);

      const stats = await service.getStats(FOLLOWING_ID);

      expect(stats.followerCount).toBe(FOLLOWING_USER.follower_count);
      expect(stats.followingCount).toBe(FOLLOWING_USER.following_count);
    });

    it('lancia errore se l\'utente non esiste', async () => {
      userService.findById.mockResolvedValue(null);
      await expect(service.getStats('nonexistent')).rejects.toThrow('User not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('removeAllFollowers', () => {
    const FOLLOWER_IDS = ['f1', 'f2', 'f3'];

    beforeEach(() => {
      followerModel.getFollowers.mockResolvedValue(FOLLOWER_IDS);
      followerModel.deleteAllFollowers.mockResolvedValue(undefined);
      followerModel.deleteAllFollowing.mockResolvedValue(undefined);
      userService.decrementFollowingCount.mockResolvedValue(undefined);
      cacheService.invalidateFollowers.mockResolvedValue(undefined);
    });

    it('elimina tutti i followers e following', async () => {
      await service.removeAllFollowers(FOLLOWING_ID);

      expect(followerModel.deleteAllFollowers).toHaveBeenCalledWith(FOLLOWING_ID);
      expect(followerModel.deleteAllFollowing).toHaveBeenCalledWith(FOLLOWING_ID);
    });

    it('decrementa following_count per ogni follower rimosso', async () => {
      await service.removeAllFollowers(FOLLOWING_ID);

      expect(userService.decrementFollowingCount).toHaveBeenCalledTimes(FOLLOWER_IDS.length);
      expect(userService.decrementFollowingCount).toHaveBeenCalledWith('f1');
      expect(userService.decrementFollowingCount).toHaveBeenCalledWith('f2');
      expect(userService.decrementFollowingCount).toHaveBeenCalledWith('f3');
    });

    it('invalida la cache dei followers dell\'utente', async () => {
      await service.removeAllFollowers(FOLLOWING_ID);
      expect(cacheService.invalidateFollowers).toHaveBeenCalledWith(FOLLOWING_ID);
    });

    it('non chiama decrementFollowingCount se non ci sono followers', async () => {
      followerModel.getFollowers.mockResolvedValue([]);

      await service.removeAllFollowers(FOLLOWING_ID);

      expect(userService.decrementFollowingCount).not.toHaveBeenCalled();
    });
  });
});
