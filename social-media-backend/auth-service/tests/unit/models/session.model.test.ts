/**
 * SessionModel — Unit Tests
 *
 * Knex mockato tramite query builder stubbed.
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

import { SessionModel }  from '../../../src/models/session.model';
import { getDatabase }   from '../../../src/config/database';
import { makeQueryBuilder, createMockSession } from '../../fixtures';
import { CreateSessionDto } from '../../../src/types';

// ─────────────────────────────────────────────────────────────────────────────

const USER_ID      = 'uid-sess-001';
const MOCK_SESSION = createMockSession(USER_ID);

describe('SessionModel', () => {
  let model: SessionModel;
  let mockDb: jest.MockedFunction<typeof getDatabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    model  = new SessionModel();
    mockDb = getDatabase as jest.MockedFunction<typeof getDatabase>;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('create', () => {
    const DTO: CreateSessionDto = {
      user_id:       USER_ID,
      refresh_token: 'refresh.token.abc',
      device_info:   'Mozilla/5.0',
      ip_address:    '192.168.1.1',
      expires_at:    new Date(Date.now() + 30 * 86_400_000),
    };

    it('inserisce la sessione e restituisce il record', async () => {
      const qb = makeQueryBuilder([MOCK_SESSION]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      const result = await model.create(DTO);

      expect(qb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id:       DTO.user_id,
          refresh_token: DTO.refresh_token,
          device_info:   DTO.device_info,
          ip_address:    DTO.ip_address,
        }),
      );
      expect(result).toEqual(MOCK_SESSION);
    });

    it('imposta created_at e last_activity come Date', async () => {
      const qb = makeQueryBuilder([MOCK_SESSION]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.create(DTO);

      const insertArg = qb.insert.mock.calls[0][0];
      expect(insertArg.created_at).toBeInstanceOf(Date);
      expect(insertArg.last_activity).toBeInstanceOf(Date);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findByRefreshToken', () => {
    it('restituisce la sessione per il refresh token', async () => {
      const qb = makeQueryBuilder(MOCK_SESSION);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      const result = await model.findByRefreshToken(MOCK_SESSION.refresh_token);

      expect(result).toEqual(MOCK_SESSION);
      expect(qb.where).toHaveBeenCalledWith({ refresh_token: MOCK_SESSION.refresh_token });
    });

    it('filtra per expires_at > now() per escludere le sessioni scadute', async () => {
      const qb = makeQueryBuilder(undefined);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.findByRefreshToken('any.token');

      // Deve contenere almeno una chiamata .where con comparatore di data
      const whereCalls = qb.where.mock.calls;
      const hasExpiryFilter = whereCalls.some(
        (call: unknown[]) => call[0] === 'expires_at' && call[1] === '>' && call[2] instanceof Date
      );
      expect(hasExpiryFilter).toBe(true);
    });

    it('restituisce null per token inesistente', async () => {
      const qb = makeQueryBuilder(undefined);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      expect(await model.findByRefreshToken('nonexistent')).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('findByUserId', () => {
    it('restituisce tutte le sessioni attive per un utente', async () => {
      const sessions = [MOCK_SESSION, createMockSession(USER_ID)];
      const qb       = makeQueryBuilder(sessions);
      // findByUserId risolve direttamente la query (no .first())
      qb.orderBy.mockResolvedValue(sessions);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      const result = await model.findByUserId(USER_ID);

      expect(result).toEqual(sessions);
      expect(qb.where).toHaveBeenCalledWith({ user_id: USER_ID });
    });

    it('ordina per last_activity discendente', async () => {
      const qb = makeQueryBuilder([]);
      qb.orderBy.mockResolvedValue([]);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.findByUserId(USER_ID);

      expect(qb.orderBy).toHaveBeenCalledWith('last_activity', 'desc');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('updateActivity', () => {
    it('aggiorna last_activity per l\'id della sessione', async () => {
      const qb = makeQueryBuilder(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.updateActivity(MOCK_SESSION.id);

      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_SESSION.id });
      expect(qb.update).toHaveBeenCalledWith(
        expect.objectContaining({ last_activity: expect.any(Date) }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('delete', () => {
    it('elimina la sessione per id', async () => {
      const qb = makeQueryBuilder(1);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.delete(MOCK_SESSION.id);

      expect(qb.where).toHaveBeenCalledWith({ id: MOCK_SESSION.id });
      expect(qb.delete).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('deleteAllForUser', () => {
    it('elimina tutte le sessioni di un utente', async () => {
      const qb = makeQueryBuilder(3);
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      await model.deleteAllForUser(USER_ID);

      expect(qb.where).toHaveBeenCalledWith({ user_id: USER_ID });
      expect(qb.delete).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('deleteExpired', () => {
    it('elimina le sessioni con expires_at nel passato e restituisce il conteggio', async () => {
      const qb = makeQueryBuilder(5);
      qb.where.mockReturnValue({ delete: jest.fn().mockResolvedValue(5) });
      mockDb.mockReturnValue(jest.fn().mockReturnValue(qb) as any);

      const result = await model.deleteExpired();

      expect(result).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('countActiveForUser', () => {
    it('restituisce il numero di sessioni attive per un utente', async () => {
      const countQb = {
        where:    jest.fn().mockReturnThis(),
        count:    jest.fn().mockReturnThis(),
        first:    jest.fn().mockResolvedValue({ count: '3' }),
      };
      mockDb.mockReturnValue(jest.fn().mockReturnValue(countQb) as any);

      const result = await model.countActiveForUser(USER_ID);

      expect(result).toBe(3);
    });

    it('restituisce 0 se non ci sono sessioni attive', async () => {
      const countQb = {
        where:  jest.fn().mockReturnThis(),
        count:  jest.fn().mockReturnThis(),
        first:  jest.fn().mockResolvedValue({ count: '0' }),
      };
      mockDb.mockReturnValue(jest.fn().mockReturnValue(countQb) as any);

      const result = await model.countActiveForUser('no-sessions-user');

      expect(result).toBe(0);
    });

    it('restituisce 0 se il count è undefined', async () => {
      const countQb = {
        where:  jest.fn().mockReturnThis(),
        count:  jest.fn().mockReturnThis(),
        first:  jest.fn().mockResolvedValue(undefined),
      };
      mockDb.mockReturnValue(jest.fn().mockReturnValue(countQb) as any);

      const result = await model.countActiveForUser('any');

      expect(result).toBe(0);
    });
  });
});
