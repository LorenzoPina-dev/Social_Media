/**
 * UserModel — Unit Tests
 *
 * Ogni metodo viene testato mockando Knex tramite una catena di builder stubbed.
 * Nessuna connessione reale al DB.
 */

// ── mock infrastruttura ───────────────────────────────────────────────────
jest.mock('../../../src/config/database', () => ({
  getDatabase:     jest.fn(),
  connectDatabase: jest.fn(),
}));
jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { UserModel }    from '../../../src/models/user.model';
import { getDatabase }  from '../../../src/config/database';
import { makeQueryBuilder, createMockUser } from '../../fixtures';

// ─────────────────────────────────────────────────────────────────────────────

const MOCK_USER = createMockUser({
  id:       'uid-model-001',
  username: 'testuser',
  email:    'test@model.com',
});

describe('UserModel', () => {
  let model: UserModel;
  let mockDb: jest.MockedFunction<typeof getDatabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    model  = new UserModel();
    mockDb = getDatabase as jest.MockedFunction<typeof getDatabase>;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findById', () => {
    it('restituisce l\'utente quando trovato', async () => {
      const qb = makeQueryBuilder(MOCK_USER);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      const result = await model.findById(MOCK_USER.id);

      expect(result).toEqual(MOCK_USER);
      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_USER.id });
      expect(qb.whereNull).toHaveBeenCalledWith('deleted_at');
      expect(qb.first).toHaveBeenCalled();
    });

    it('restituisce null se non trovato', async () => {
      const qb = makeQueryBuilder(undefined);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      expect(await model.findById('nonexistent')).toBeNull();
    });

    it('applica il filtro whereNull(deleted_at) per escludere i soft-deleted', async () => {
      const qb = makeQueryBuilder(undefined);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.findById('uid-deleted');

      expect(qb.whereNull).toHaveBeenCalledWith('deleted_at');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findByEmail', () => {
    it('restituisce l\'utente per email', async () => {
      const qb = makeQueryBuilder(MOCK_USER);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      const result = await model.findByEmail(MOCK_USER.email);

      expect(result).toEqual(MOCK_USER);
      expect(qb.where).toHaveBeenCalledWith({ email: MOCK_USER.email });
    });

    it('restituisce null se email non trovata', async () => {
      const qb = makeQueryBuilder(undefined);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      expect(await model.findByEmail('nobody@x.com')).toBeNull();
    });

    it('applica filtro whereNull(deleted_at)', async () => {
      const qb = makeQueryBuilder(undefined);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.findByEmail('x@x.com');

      expect(qb.whereNull).toHaveBeenCalledWith('deleted_at');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findByUsername', () => {
    it('restituisce l\'utente per username', async () => {
      const qb = makeQueryBuilder(MOCK_USER);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      const result = await model.findByUsername(MOCK_USER.username);

      expect(result).toEqual(MOCK_USER);
      expect(qb.where).toHaveBeenCalledWith({ username: MOCK_USER.username });
    });

    it('restituisce null se username non trovato', async () => {
      const qb = makeQueryBuilder(undefined);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      expect(await model.findByUsername('nobody')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('create', () => {
    const DTO = {
      username:     'newuser',
      email:        'new@example.com',
      password:     'Secure1!Pass',
      display_name: 'New User',
    };

    it('inserisce e restituisce il record creato', async () => {
      const qb = makeQueryBuilder([MOCK_USER]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      const result = await model.create(DTO);

      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          username:     DTO.username,
          email:        DTO.email,
          display_name: DTO.display_name,
          verified:     false,
          mfa_enabled:  false,
          status:       'ACTIVE',
        }),
      );
      expect(result).toEqual(MOCK_USER);
    });

    it('hash la password con argon2 (password_hash != password)', async () => {
      const qb = makeQueryBuilder([MOCK_USER]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.create(DTO);

      const insertArg = qb.insert.mock.calls[0][0];
      expect(insertArg.password_hash).toBeDefined();
      expect(insertArg.password_hash).not.toBe(DTO.password);
      expect(insertArg.password_hash).toMatch(/^\$argon2/);
    });

    it('imposta created_at e updated_at come Date', async () => {
      const qb = makeQueryBuilder([MOCK_USER]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.create(DTO);

      const insertArg = qb.insert.mock.calls[0][0];
      expect(insertArg.created_at).toBeInstanceOf(Date);
      expect(insertArg.updated_at).toBeInstanceOf(Date);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('update', () => {
    it('aggiorna e restituisce il record aggiornato', async () => {
      const updated = { ...MOCK_USER, display_name: 'Updated' };
      const qb      = makeQueryBuilder([updated]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      const result = await model.update(MOCK_USER.id, { display_name: 'Updated' });

      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_USER.id });
      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({ display_name: 'Updated' }),
      );
      expect(result.display_name).toBe('Updated');
    });

    it('include updated_at nel payload di update', async () => {
      const qb = makeQueryBuilder([MOCK_USER]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.update(MOCK_USER.id, { display_name: 'X' });

      expect(qb.update.mock.calls[0][0].updated_at).toBeInstanceOf(Date);
    });

    it('lancia errore se il record non viene trovato (returning vuoto)', async () => {
      const qb = makeQueryBuilder([]);
      qb.returning.mockResolvedValue([]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await expect(model.update('nonexistent', { display_name: 'X' })).rejects.toThrow('User not found');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('verifyPassword', () => {
    it('restituisce true per password corretta', async () => {
      // Creiamo un hash reale con argon2 per testare la verifica
      const argon2 = await import('argon2');
      const hash   = await argon2.hash('MySecret1!', { type: argon2.argon2id });
      const user   = { ...MOCK_USER, password_hash: hash };

      const result = await model.verifyPassword(user, 'MySecret1!');
      expect(result).toBe(true);
    });

    it('restituisce false per password errata', async () => {
      const argon2 = await import('argon2');
      const hash   = await argon2.hash('MySecret1!', { type: argon2.argon2id });
      const user   = { ...MOCK_USER, password_hash: hash };

      const result = await model.verifyPassword(user, 'WrongPassword!');
      expect(result).toBe(false);
    });

    it('restituisce false (non lancia) per hash malformato', async () => {
      const user = { ...MOCK_USER, password_hash: 'not-a-valid-hash' };
      const result = await model.verifyPassword(user, 'anypassword');
      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('updatePassword', () => {
    it('aggiorna l\'hash della password nel DB', async () => {
      const qb = makeQueryBuilder(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.updatePassword(MOCK_USER.id, 'NewPass1!');

      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_USER.id });
      const updateArg = qb.update.mock.calls[0][0];
      expect(updateArg.password_hash).toMatch(/^\$argon2/);
      expect(updateArg.password_hash).not.toBe('NewPass1!');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('enableMFA', () => {
    it('imposta mfa_enabled=true e mfa_secret nel DB', async () => {
      const qb = makeQueryBuilder(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.enableMFA(MOCK_USER.id, 'BASE32SECRET');

      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_USER.id });
      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({ mfa_enabled: true, mfa_secret: 'BASE32SECRET' }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('disableMFA', () => {
    it('imposta mfa_enabled=false e mfa_secret=null nel DB', async () => {
      const qb = makeQueryBuilder(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.disableMFA(MOCK_USER.id);

      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({ mfa_enabled: false, mfa_secret: null }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('markVerified', () => {
    it('imposta verified=true nel DB', async () => {
      const qb = makeQueryBuilder(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.markVerified(MOCK_USER.id);

      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({ verified: true }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('suspend', () => {
    it('imposta status=SUSPENDED nel DB', async () => {
      const qb = makeQueryBuilder(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.suspend(MOCK_USER.id);

      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUSPENDED' }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('softDelete', () => {
    it('imposta deleted_at e status=PENDING_DELETION', async () => {
      const qb = makeQueryBuilder(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.softDelete(MOCK_USER.id);

      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_USER.id });
      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: expect.any(Date),
          status:     'PENDING_DELETION',
        }),
      );
    });
  });
});
