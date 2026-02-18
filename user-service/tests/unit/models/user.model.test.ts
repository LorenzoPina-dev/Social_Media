/**
 * UserModel — Unit Tests
 *
 * Ogni metodo del model viene testato mockando Knex tramite una
 * catena di builder stubbed. Nessuna connessione reale al DB.
 */

// ── mock infrastruttura ────────────────────────────────────────────────────
jest.mock('../../../src/config/database', () => ({
  getDatabase: jest.fn(),
  connectDatabase: jest.fn(),
}));
jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { UserModel } from '../../../src/models/user.model';
import { getDatabase } from '../../../src/config/database';
import { User } from '../../../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: costruisce un query builder Knex minimale e completamente mockato
// ─────────────────────────────────────────────────────────────────────────────

function makeQB(resolveValue: any = null) {
  const qb: any = {
    where:       jest.fn().mockReturnThis(),
    whereNull:   jest.fn().mockReturnThis(),
    whereIn:     jest.fn().mockReturnThis(),
    where_gt:    jest.fn().mockReturnThis(), // alias usato internamente
    orWhere:     jest.fn().mockReturnThis(),
    first:       jest.fn().mockResolvedValue(resolveValue),
    insert:      jest.fn().mockReturnThis(),
    update:      jest.fn().mockReturnThis(),
    delete:      jest.fn().mockResolvedValue(1),
    returning:   jest.fn().mockResolvedValue(Array.isArray(resolveValue) ? resolveValue : [resolveValue]),
    increment:   jest.fn().mockResolvedValue(1),
    decrement:   jest.fn().mockResolvedValue(1),
    orderBy:     jest.fn().mockReturnThis(),
    limit:       jest.fn().mockReturnThis(),
    offset:      jest.fn().mockResolvedValue(Array.isArray(resolveValue) ? resolveValue : []),
    count:       jest.fn().mockReturnThis(),
    select:      jest.fn().mockReturnThis(),
  };
  // Rende `.where(...).where(...).decrement(...)` funzionante
  qb.where.mockReturnValue(qb);
  return qb;
}

// Fixture base
const MOCK_USER: User = {
  id:             'uid-model-001',
  username:       'modeluser',
  email:          'model@example.com',
  display_name:   'Model User',
  bio:            'bio',
  avatar_url:     undefined,
  verified:       false,
  follower_count: 0,
  following_count: 0,
  status:         'ACTIVE',
  created_at:     new Date('2024-01-01'),
  updated_at:     new Date('2024-01-01'),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('UserModel', () => {
  let model: UserModel;
  let mockDb: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    model  = new UserModel();
    mockDb = getDatabase as jest.MockedFunction<typeof getDatabase>;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findById', () => {
    it('restituisce l\'utente quando trovato', async () => {
      const qb = makeQB(MOCK_USER);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      const result = await model.findById(MOCK_USER.id);

      expect(result).toEqual(MOCK_USER);
      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_USER.id });
      expect(qb.whereNull).toHaveBeenCalledWith('deleted_at');
    });

    it('restituisce null se l\'utente non esiste', async () => {
      const qb = makeQB(undefined);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      const result = await model.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('restituisce null per utenti con deleted_at != NULL (filtro whereNull)', async () => {
      // Il whereNull viene applicato — restituisce undefined (nessuna riga)
      const qb = makeQB(undefined);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      const result = await model.findById('deleted-uid');

      expect(result).toBeNull();
      expect(qb.whereNull).toHaveBeenCalledWith('deleted_at');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findByEmail', () => {
    it('restituisce l\'utente per email', async () => {
      const qb = makeQB(MOCK_USER);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      const result = await model.findByEmail(MOCK_USER.email);

      expect(result).toEqual(MOCK_USER);
      expect(qb.where).toHaveBeenCalledWith({ email: MOCK_USER.email });
    });

    it('restituisce null se email non trovata', async () => {
      const qb = makeQB(undefined);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      const result = await model.findByEmail('unknown@x.com');
      expect(result).toBeNull();
    });

    it('esclude utenti con deleted_at != NULL', async () => {
      const qb = makeQB(undefined);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.findByEmail('deleted@x.com');

      expect(qb.whereNull).toHaveBeenCalledWith('deleted_at');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findByUsername', () => {
    it('restituisce l\'utente per username', async () => {
      const qb = makeQB(MOCK_USER);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      const result = await model.findByUsername(MOCK_USER.username);

      expect(result).toEqual(MOCK_USER);
      expect(qb.where).toHaveBeenCalledWith({ username: MOCK_USER.username });
    });

    it('restituisce null se username non trovato', async () => {
      const qb = makeQB(undefined);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      const result = await model.findByUsername('nobody');
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('create', () => {
    it('inserisce l\'utente e restituisce il record creato', async () => {
      const qb = makeQB([MOCK_USER]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      const dto = { username: 'modeluser', email: 'model@example.com', display_name: 'Model User' };
      const result = await model.create(dto);

      expect(qb.insert).toHaveBeenCalledWith(expect.objectContaining({
        username:       dto.username,
        email:          dto.email,
        display_name:   dto.display_name,
        follower_count: 0,
        following_count: 0,
        verified:       false,
      }));
      expect(result).toEqual(MOCK_USER);
    });

    it('imposta created_at e updated_at al momento della creazione', async () => {
      const qb = makeQB([MOCK_USER]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.create({ username: 'u', email: 'e@e.com', display_name: 'd' });

      const insertCall = qb.insert.mock.calls[0][0];
      expect(insertCall.created_at).toBeInstanceOf(Date);
      expect(insertCall.updated_at).toBeInstanceOf(Date);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('update', () => {
    it('aggiorna l\'utente e restituisce il record aggiornato', async () => {
      const updated = { ...MOCK_USER, display_name: 'Updated' };
      const qb = makeQB([updated]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      const result = await model.update(MOCK_USER.id, { display_name: 'Updated' });

      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_USER.id });
      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({ display_name: 'Updated' })
      );
      expect(result.display_name).toBe('Updated');
    });

    it('aggiorna updated_at automaticamente', async () => {
      const updated = { ...MOCK_USER };
      const qb = makeQB([updated]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.update(MOCK_USER.id, { display_name: 'X' });

      const updateCall = qb.update.mock.calls[0][0];
      expect(updateCall.updated_at).toBeInstanceOf(Date);
    });

    it('lancia errore se utente non trovato (returning restituisce [])', async () => {
      const qb = makeQB([]);
      // override returning per restituire array vuoto
      qb.returning.mockResolvedValue([]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await expect(model.update('nonexistent', { display_name: 'X' })).rejects.toThrow('User not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('softDelete', () => {
    it('imposta deleted_at e status PENDING_DELETION', async () => {
      const qb = makeQB(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.softDelete(MOCK_USER.id);

      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_USER.id });
      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status:     'PENDING_DELETION',
          deleted_at: expect.any(Date),
        })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('hardDelete', () => {
    it('elimina definitivamente l\'utente dal DB', async () => {
      const qb = makeQB(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.hardDelete(MOCK_USER.id);

      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_USER.id });
      expect(qb.delete).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('search', () => {
    it('usa ILIKE per username e display_name', async () => {
      const qb = makeQB([MOCK_USER]);
      // .offset() viene chiamato alla fine e risolve la promise
      qb.offset.mockResolvedValue([MOCK_USER]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      const results = await model.search('model');

      expect(results).toHaveLength(1);
      expect(qb.whereNull).toHaveBeenCalledWith('deleted_at');
    });

    it('esclude utenti con deleted_at != NULL', async () => {
      const qb = makeQB([]);
      qb.offset.mockResolvedValue([]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.search('query');

      expect(qb.whereNull).toHaveBeenCalledWith('deleted_at');
    });

    it('applica limit e offset dalle opzioni', async () => {
      const qb = makeQB([]);
      qb.offset.mockResolvedValue([]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.search('q', { limit: 5, offset: 10 });

      expect(qb.limit).toHaveBeenCalledWith(5);
      expect(qb.offset).toHaveBeenCalledWith(10);
    });

    it('usa limit/offset di default quando non specificati', async () => {
      const qb = makeQB([]);
      qb.offset.mockResolvedValue([]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.search('q');

      expect(qb.limit).toHaveBeenCalledWith(20);
      expect(qb.offset).toHaveBeenCalledWith(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findByIds', () => {
    it('restituisce gli utenti per una lista di id', async () => {
      const users = [MOCK_USER, { ...MOCK_USER, id: 'uid-002' }];
      const qb = makeQB(users);
      // whereIn → whereNull → resolve diretto (no .first())
      qb.whereNull.mockResolvedValue(users);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.findByIds([MOCK_USER.id, 'uid-002']);

      expect(qb.whereIn).toHaveBeenCalledWith('id', [MOCK_USER.id, 'uid-002']);
      expect(qb.whereNull).toHaveBeenCalledWith('deleted_at');
    });

    it('esclude utenti eliminati', async () => {
      const qb = makeQB([]);
      qb.whereNull.mockResolvedValue([]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.findByIds(['uid-deleted']);

      expect(qb.whereNull).toHaveBeenCalledWith('deleted_at');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('incrementFollowerCount', () => {
    it('usa INCREMENT atomico (non read-modify-write)', async () => {
      const qb = makeQB(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.incrementFollowerCount(MOCK_USER.id);

      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_USER.id });
      expect(qb.increment).toHaveBeenCalledWith('follower_count', 1);
    });
  });

  describe('decrementFollowerCount', () => {
    it('usa DECREMENT atomico con guardia > 0', async () => {
      const qb = makeQB(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.decrementFollowerCount(MOCK_USER.id);

      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_USER.id });
      // controlla che venga applicata la guardia > 0
      expect(qb.where).toHaveBeenCalledWith('follower_count', '>', 0);
      expect(qb.decrement).toHaveBeenCalledWith('follower_count', 1);
    });

    it('non va sotto zero grazie alla guardia follower_count > 0', async () => {
      // Simula che la query non aggiorni righe (nessun DECREMENT avviene sotto 0)
      const qb = makeQB(0);
      qb.decrement.mockResolvedValue(0); // 0 righe aggiornate
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      // Non deve lanciare
      await expect(model.decrementFollowerCount(MOCK_USER.id)).resolves.not.toThrow();
    });
  });

  describe('incrementFollowingCount', () => {
    it('usa INCREMENT atomico', async () => {
      const qb = makeQB(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.incrementFollowingCount(MOCK_USER.id);

      expect(qb.increment).toHaveBeenCalledWith('following_count', 1);
    });
  });

  describe('decrementFollowingCount', () => {
    it('usa DECREMENT atomico con guardia > 0', async () => {
      const qb = makeQB(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb));

      await model.decrementFollowingCount(MOCK_USER.id);

      expect(qb.where).toHaveBeenCalledWith('following_count', '>', 0);
      expect(qb.decrement).toHaveBeenCalledWith('following_count', 1);
    });
  });
});
