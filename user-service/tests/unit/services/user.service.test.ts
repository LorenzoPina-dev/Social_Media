/**
 * UserService — Unit Tests
 *
 * Dipendenze mockate: UserModel, CacheService, UserProducer.
 * La logica testata è quella reale di user.service.ts.
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
  userMetrics: { userCreated: { inc: jest.fn() }, userUpdated: { inc: jest.fn() }, userDeleted: { inc: jest.fn() }, userRetrieved: { inc: jest.fn() }, userSearched: { inc: jest.fn() }, requestDuration: { observe: jest.fn() }, userFollowed: { inc: jest.fn() }, userUnfollowed: { inc: jest.fn() }, cacheHit: { inc: jest.fn() }, cacheMiss: { inc: jest.fn() }, dbQueryDuration: { observe: jest.fn() } },
  default: { incrementCounter: jest.fn(), recordRequestDuration: jest.fn() },
}));
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/services/cache.service');
jest.mock('../../../src/kafka/producers/user.producer');

import { UserService }   from '../../../src/services/user.service';
import { UserModel }     from '../../../src/models/user.model';
import { CacheService }  from '../../../src/services/cache.service';
import { UserProducer }  from '../../../src/kafka/producers/user.producer';
import { User }          from '../../../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_USER: User = {
  id:             'uid-001',
  username:       'alice',
  email:          'alice@example.com',
  display_name:   'Alice Wonderland',
  bio:            'Just a test user',
  avatar_url:     'https://cdn.example.com/alice.png',
  verified:       true,
  follower_count: 120,
  following_count: 45,
  status:         'ACTIVE',
  created_at:     new Date('2024-01-01'),
  updated_at:     new Date('2024-01-01'),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('UserService', () => {
  let service: UserService;
  let userModel: jest.Mocked<UserModel>;
  let cacheService: jest.Mocked<CacheService>;
  let userProducer: jest.Mocked<UserProducer>;

  beforeEach(() => {
    jest.clearAllMocks();

    userModel    = new UserModel()    as jest.Mocked<UserModel>;
    cacheService = new CacheService() as jest.Mocked<CacheService>;
    userProducer = new UserProducer() as jest.Mocked<UserProducer>;

    service = new UserService(userModel, cacheService, userProducer);

    // Default: publish non lancia
    userProducer.publishUserCreated.mockResolvedValue(undefined);
    userProducer.publishUserUpdated.mockResolvedValue(undefined);
    userProducer.publishUserDeletionRequested.mockResolvedValue(undefined);
    userProducer.publishUserDeleted.mockResolvedValue(undefined);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findById', () => {
    it('restituisce l\'utente dalla cache senza toccare il DB', async () => {
      cacheService.getUser.mockResolvedValue(MOCK_USER);

      const result = await service.findById(MOCK_USER.id);

      expect(result).toEqual(MOCK_USER);
      expect(cacheService.getUser).toHaveBeenCalledWith(MOCK_USER.id);
      expect(userModel.findById).not.toHaveBeenCalled();
    });

    it('recupera dal DB se cache miss, poi salva in cache', async () => {
      cacheService.getUser.mockResolvedValue(null);
      userModel.findById.mockResolvedValue(MOCK_USER);

      const result = await service.findById(MOCK_USER.id);

      expect(result).toEqual(MOCK_USER);
      expect(userModel.findById).toHaveBeenCalledWith(MOCK_USER.id);
      expect(cacheService.setUser).toHaveBeenCalledWith(MOCK_USER);
    });

    it('restituisce null se utente non esiste e non popola la cache', async () => {
      cacheService.getUser.mockResolvedValue(null);
      userModel.findById.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
      expect(cacheService.setUser).not.toHaveBeenCalled();
    });

    it('rilancia l\'errore se il DB fallisce', async () => {
      cacheService.getUser.mockResolvedValue(null);
      userModel.findById.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.findById(MOCK_USER.id)).rejects.toThrow('DB connection lost');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findByEmail', () => {
    it('chiama userModel.findByEmail e restituisce il risultato', async () => {
      userModel.findByEmail.mockResolvedValue(MOCK_USER);

      const result = await service.findByEmail('alice@example.com');

      expect(result).toEqual(MOCK_USER);
      expect(userModel.findByEmail).toHaveBeenCalledWith('alice@example.com');
    });

    it('restituisce null se non trovato', async () => {
      userModel.findByEmail.mockResolvedValue(null);
      expect(await service.findByEmail('x@x.com')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findByUsername', () => {
    it('chiama userModel.findByUsername e restituisce il risultato', async () => {
      userModel.findByUsername.mockResolvedValue(MOCK_USER);

      const result = await service.findByUsername('alice');

      expect(result).toEqual(MOCK_USER);
      expect(userModel.findByUsername).toHaveBeenCalledWith('alice');
    });

    it('restituisce null se non trovato', async () => {
      userModel.findByUsername.mockResolvedValue(null);
      expect(await service.findByUsername('nobody')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('create', () => {
    const DTO = { username: 'newuser', email: 'new@example.com', display_name: 'New User' };

    beforeEach(() => {
      userModel.findByUsername.mockResolvedValue(null);
      userModel.findByEmail.mockResolvedValue(null);
      userModel.create.mockResolvedValue({ ...MOCK_USER, ...DTO });
    });

    it('crea l\'utente e restituisce l\'oggetto creato', async () => {
      const result = await service.create(DTO);
      expect(result.username).toBe(DTO.username);
      expect(result.email).toBe(DTO.email);
    });

    it('verifica unicità username prima di creare', async () => {
      await service.create(DTO);
      expect(userModel.findByUsername).toHaveBeenCalledWith(DTO.username);
    });

    it('verifica unicità email prima di creare', async () => {
      await service.create(DTO);
      expect(userModel.findByEmail).toHaveBeenCalledWith(DTO.email);
    });

    it('chiama userModel.create con il DTO completo', async () => {
      await service.create(DTO);
      expect(userModel.create).toHaveBeenCalledWith(DTO);
    });

    it('salva l\'utente in cache dopo la creazione', async () => {
      await service.create(DTO);
      expect(cacheService.setUser).toHaveBeenCalledTimes(1);
    });

    it('pubblica l\'evento user_created', async () => {
      await service.create(DTO);
      expect(userProducer.publishUserCreated).toHaveBeenCalledWith(
        expect.objectContaining({ username: DTO.username, email: DTO.email }),
      );
    });

    it('lancia errore se username già esistente', async () => {
      userModel.findByUsername.mockResolvedValue(MOCK_USER);
      await expect(service.create(DTO)).rejects.toThrow('Username already exists');
      expect(userModel.create).not.toHaveBeenCalled();
    });

    it('lancia errore se email già esistente', async () => {
      userModel.findByEmail.mockResolvedValue(MOCK_USER);
      await expect(service.create(DTO)).rejects.toThrow('Email already exists');
      expect(userModel.create).not.toHaveBeenCalled();
    });

    it('non pubblica l\'evento se la creazione fallisce', async () => {
      userModel.create.mockRejectedValue(new Error('DB error'));
      await expect(service.create(DTO)).rejects.toThrow();
      expect(userProducer.publishUserCreated).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('update', () => {
    const UPDATE = { display_name: 'Alice Updated', bio: 'New bio' };

    beforeEach(() => {
      userModel.update.mockResolvedValue({ ...MOCK_USER, ...UPDATE });
      cacheService.deleteUser.mockResolvedValue(undefined);
    });

    it('aggiorna l\'utente e restituisce i dati aggiornati', async () => {
      const result = await service.update(MOCK_USER.id, UPDATE);
      expect(result.display_name).toBe('Alice Updated');
    });

    it('chiama userModel.update con id e dati corretti', async () => {
      await service.update(MOCK_USER.id, UPDATE);
      expect(userModel.update).toHaveBeenCalledWith(MOCK_USER.id, UPDATE);
    });

    it('invalida la cache dopo l\'aggiornamento', async () => {
      await service.update(MOCK_USER.id, UPDATE);
      expect(cacheService.deleteUser).toHaveBeenCalledWith(MOCK_USER.id);
    });

    it('pubblica l\'evento user_updated', async () => {
      await service.update(MOCK_USER.id, UPDATE);
      expect(userProducer.publishUserUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ userId: MOCK_USER.id, changes: UPDATE }),
      );
    });

    it('rilancia l\'errore se userModel.update fallisce', async () => {
      userModel.update.mockRejectedValue(new Error('User not found'));
      await expect(service.update(MOCK_USER.id, UPDATE)).rejects.toThrow('User not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('softDelete', () => {
    beforeEach(() => {
      userModel.softDelete.mockResolvedValue(undefined);
      cacheService.deleteUser.mockResolvedValue(undefined);
    });

    it('esegue soft delete nel DB', async () => {
      await service.softDelete(MOCK_USER.id);
      expect(userModel.softDelete).toHaveBeenCalledWith(MOCK_USER.id);
    });

    it('invalida la cache', async () => {
      await service.softDelete(MOCK_USER.id);
      expect(cacheService.deleteUser).toHaveBeenCalledWith(MOCK_USER.id);
    });

    it('pubblica l\'evento user_deletion_requested', async () => {
      await service.softDelete(MOCK_USER.id);
      expect(userProducer.publishUserDeletionRequested).toHaveBeenCalledWith(
        expect.objectContaining({ userId: MOCK_USER.id, gracePeriodDays: 30 }),
      );
    });

    it('rilancia l\'errore se softDelete fallisce', async () => {
      userModel.softDelete.mockRejectedValue(new Error('DB error'));
      await expect(service.softDelete(MOCK_USER.id)).rejects.toThrow('DB error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('hardDelete', () => {
    beforeEach(() => {
      userModel.hardDelete.mockResolvedValue(undefined);
      cacheService.deleteUser.mockResolvedValue(undefined);
    });

    it('esegue hard delete nel DB', async () => {
      await service.hardDelete(MOCK_USER.id);
      expect(userModel.hardDelete).toHaveBeenCalledWith(MOCK_USER.id);
    });

    it('invalida la cache', async () => {
      await service.hardDelete(MOCK_USER.id);
      expect(cacheService.deleteUser).toHaveBeenCalledWith(MOCK_USER.id);
    });

    it('pubblica l\'evento user_deleted', async () => {
      await service.hardDelete(MOCK_USER.id);
      expect(userProducer.publishUserDeleted).toHaveBeenCalledWith(
        expect.objectContaining({ userId: MOCK_USER.id }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('search', () => {
    const RESULTS = [MOCK_USER];
    const QUERY   = 'alice';
    const OPTS    = { limit: 10, offset: 0 };

    it('restituisce risultati dalla cache se disponibili', async () => {
      cacheService.get.mockResolvedValue(JSON.stringify(RESULTS));

      const result = (await service.search(QUERY, OPTS)).map(u => ({
        ...u,
        created_at: new Date(u.created_at),
        updated_at: new Date(u.updated_at),
      }));
      expect(result).toEqual(RESULTS);
      expect(userModel.search).not.toHaveBeenCalled();
    });

    it('cerca nel DB se cache miss e salva il risultato', async () => {
      cacheService.get.mockResolvedValue(null);
      userModel.search.mockResolvedValue(RESULTS);

      const result = await service.search(QUERY, OPTS);

      expect(result).toEqual(RESULTS);
      expect(userModel.search).toHaveBeenCalledWith(QUERY, OPTS);
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining(QUERY),
        expect.any(String),
        600,
      );
    });

    it('la cache key include query e opzioni', async () => {
      cacheService.get.mockResolvedValue(null);
      userModel.search.mockResolvedValue([]);

      await service.search(QUERY, OPTS);

      expect(cacheService.get).toHaveBeenCalledWith(
        `search:${QUERY}:${JSON.stringify(OPTS)}`,
      );
    });

    it('usa opzioni default {} quando non specificate', async () => {
      cacheService.get.mockResolvedValue(null);
      userModel.search.mockResolvedValue([]);

      await service.search(QUERY);

      expect(userModel.search).toHaveBeenCalledWith(QUERY, {});
    });

    it('restituisce array vuoto se non ci sono risultati', async () => {
      cacheService.get.mockResolvedValue(null);
      userModel.search.mockResolvedValue([]);

      const result = await service.search(QUERY);
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findByIds', () => {
    const USER_A: User = { ...MOCK_USER, id: 'uid-A' };
    const USER_B: User = { ...MOCK_USER, id: 'uid-B' };
    const USER_C: User = { ...MOCK_USER, id: 'uid-C' };

    it('restituisce tutti dalla cache quando disponibili', async () => {
      cacheService.getUser
        .mockResolvedValueOnce(USER_A)
        .mockResolvedValueOnce(USER_B)
        .mockResolvedValueOnce(USER_C);

      const result = await service.findByIds(['uid-A', 'uid-B', 'uid-C']);

      expect(result).toHaveLength(3);
      expect(userModel.findByIds).not.toHaveBeenCalled();
    });

    it('recupera dal DB solo gli id non in cache', async () => {
      cacheService.getUser
        .mockResolvedValueOnce(USER_A)   // uid-A in cache
        .mockResolvedValueOnce(null)      // uid-B miss
        .mockResolvedValueOnce(null);     // uid-C miss

      userModel.findByIds.mockResolvedValue([USER_B, USER_C]);

      const result = await service.findByIds(['uid-A', 'uid-B', 'uid-C']);

      expect(result).toHaveLength(3);
      expect(userModel.findByIds).toHaveBeenCalledWith(['uid-B', 'uid-C']);
    });

    it('salva in cache gli utenti recuperati dal DB', async () => {
      cacheService.getUser.mockResolvedValue(null);
      userModel.findByIds.mockResolvedValue([USER_A, USER_B]);

      await service.findByIds(['uid-A', 'uid-B']);

      expect(cacheService.setUser).toHaveBeenCalledTimes(2);
    });

    it('non chiama il DB se tutti gli id sono in cache', async () => {
      cacheService.getUser.mockResolvedValue(USER_A);

      await service.findByIds(['uid-A']);

      expect(userModel.findByIds).not.toHaveBeenCalled();
    });

    it('restituisce array vuoto se nessun id trovato', async () => {
      cacheService.getUser.mockResolvedValue(null);
      userModel.findByIds.mockResolvedValue([]);

      const result = await service.findByIds(['uid-X']);
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('incrementFollowerCount / decrementFollowerCount', () => {
    beforeEach(() => {
      userModel.incrementFollowerCount.mockResolvedValue(undefined);
      userModel.decrementFollowerCount.mockResolvedValue(undefined);
      cacheService.deleteUser.mockResolvedValue(undefined);
    });

    it('incrementa il follower count e invalida la cache', async () => {
      await service.incrementFollowerCount(MOCK_USER.id);

      expect(userModel.incrementFollowerCount).toHaveBeenCalledWith(MOCK_USER.id);
      expect(cacheService.deleteUser).toHaveBeenCalledWith(MOCK_USER.id);
    });

    it('decrementa il follower count e invalida la cache', async () => {
      await service.decrementFollowerCount(MOCK_USER.id);

      expect(userModel.decrementFollowerCount).toHaveBeenCalledWith(MOCK_USER.id);
      expect(cacheService.deleteUser).toHaveBeenCalledWith(MOCK_USER.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('incrementFollowingCount / decrementFollowingCount', () => {
    beforeEach(() => {
      userModel.incrementFollowingCount.mockResolvedValue(undefined);
      userModel.decrementFollowingCount.mockResolvedValue(undefined);
      cacheService.deleteUser.mockResolvedValue(undefined);
    });

    it('incrementa il following count e invalida la cache', async () => {
      await service.incrementFollowingCount(MOCK_USER.id);

      expect(userModel.incrementFollowingCount).toHaveBeenCalledWith(MOCK_USER.id);
      expect(cacheService.deleteUser).toHaveBeenCalledWith(MOCK_USER.id);
    });

    it('decrementa il following count e invalida la cache', async () => {
      await service.decrementFollowingCount(MOCK_USER.id);

      expect(userModel.decrementFollowingCount).toHaveBeenCalledWith(MOCK_USER.id);
      expect(cacheService.deleteUser).toHaveBeenCalledWith(MOCK_USER.id);
    });
  });
});
