/**
 * SessionService — Unit Tests
 *
 * Dipendenze mockate: SessionModel.
 * La logica testata è quella reale di session.service.ts.
 */

// ── mock infrastruttura ───────────────────────────────────────────────────
jest.mock('../../../src/config/database', () => ({ getDatabase: jest.fn(), connectDatabase: jest.fn() }));
jest.mock('../../../src/config/redis',    () => ({ getRedisClient: jest.fn(), connectRedis: jest.fn() }));
jest.mock('../../../src/config/kafka',    () => ({ getKafkaProducer: jest.fn(), connectKafka: jest.fn() }));
jest.mock('../../../src/utils/logger',    () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/utils/metrics', () => ({
  metrics: { incrementCounter: jest.fn(), recordRequestDuration: jest.fn() },
}));
jest.mock('../../../src/models/session.model');

import { SessionService } from '../../../src/services/session.service';
import { SessionModel }   from '../../../src/models/session.model';
import { createMockSession } from '../../fixtures';

// ─────────────────────────────────────────────────────────────────────────────

const USER_ID = 'uid-sess-svc-001';

describe('SessionService', () => {
  let service: SessionService;
  let sessionModel: jest.Mocked<SessionModel>;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionModel = new SessionModel() as jest.Mocked<SessionModel>;
    service      = new SessionService(sessionModel);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('createSession', () => {
    const REFRESH_TOKEN = 'refresh.token.xyz';

    it('crea e restituisce la sessione per dati validi', async () => {
      const session = createMockSession(USER_ID, { refresh_token: REFRESH_TOKEN });
      sessionModel.countActiveForUser.mockResolvedValue(0);
      sessionModel.create.mockResolvedValue(session);

      const result = await service.createSession(USER_ID, REFRESH_TOKEN, '10.0.0.1', 'Mozilla/5.0');

      expect(result).toEqual(session);
      expect(sessionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id:       USER_ID,
          refresh_token: REFRESH_TOKEN,
          ip_address:    '10.0.0.1',
          device_info:   'Mozilla/5.0',
          expires_at:    expect.any(Date),
        }),
      );
    });

    it('la data di scadenza è nel futuro', async () => {
      const session = createMockSession(USER_ID);
      sessionModel.countActiveForUser.mockResolvedValue(0);
      sessionModel.create.mockResolvedValue(session);

      await service.createSession(USER_ID, REFRESH_TOKEN);

      const createArg = sessionModel.create.mock.calls[0][0];
      expect(createArg.expires_at.getTime()).toBeGreaterThan(Date.now());
    });

    it('crea sessione senza ip e device info', async () => {
      const session = createMockSession(USER_ID);
      sessionModel.countActiveForUser.mockResolvedValue(0);
      sessionModel.create.mockResolvedValue(session);

      await service.createSession(USER_ID, REFRESH_TOKEN);

      const createArg = sessionModel.create.mock.calls[0][0];
      expect(createArg.ip_address).toBeUndefined();
      expect(createArg.device_info).toBeUndefined();
    });

    it('elimina la sessione più vecchia quando il limite (5) è raggiunto', async () => {
      const sessions = Array.from({ length: 5 }, () => createMockSession(USER_ID));
      sessionModel.countActiveForUser.mockResolvedValue(5);
      sessionModel.findByUserId.mockResolvedValue(sessions);
      sessionModel.delete.mockResolvedValue(undefined);
      sessionModel.create.mockResolvedValue(sessions[0]);

      await service.createSession(USER_ID, REFRESH_TOKEN);

      // Deve eliminare la più vecchia (ultimo elemento dell'array ordinato per last_activity desc)
      expect(sessionModel.delete).toHaveBeenCalledWith(sessions[sessions.length - 1].id);
      expect(sessionModel.create).toHaveBeenCalledTimes(1);
    });

    it('non elimina sessioni quando il conteggio è sotto il limite', async () => {
      sessionModel.countActiveForUser.mockResolvedValue(3);
      sessionModel.create.mockResolvedValue(createMockSession(USER_ID));

      await service.createSession(USER_ID, REFRESH_TOKEN);

      expect(sessionModel.delete).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('getUserSessions', () => {
    it('restituisce tutte le sessioni dell\'utente', async () => {
      const sessions = [createMockSession(USER_ID), createMockSession(USER_ID)];
      sessionModel.findByUserId.mockResolvedValue(sessions);

      const result = await service.getUserSessions(USER_ID);

      expect(result).toEqual(sessions);
      expect(sessionModel.findByUserId).toHaveBeenCalledWith(USER_ID);
    });

    it('restituisce array vuoto se non ci sono sessioni', async () => {
      sessionModel.findByUserId.mockResolvedValue([]);

      const result = await service.getUserSessions(USER_ID);

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('deleteSession', () => {
    it('chiama sessionModel.delete con l\'id corretto', async () => {
      sessionModel.delete.mockResolvedValue(undefined);

      await service.deleteSession('sess-id-001');

      expect(sessionModel.delete).toHaveBeenCalledWith('sess-id-001');
    });

    it('rilancia errori del modello', async () => {
      sessionModel.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteSession('sess-id-001')).rejects.toThrow('DB error');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('deleteAllUserSessions', () => {
    it('chiama sessionModel.deleteAllForUser con l\'userId', async () => {
      sessionModel.deleteAllForUser.mockResolvedValue(undefined);

      await service.deleteAllUserSessions(USER_ID);

      expect(sessionModel.deleteAllForUser).toHaveBeenCalledWith(USER_ID);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('cleanupExpiredSessions', () => {
    it('chiama sessionModel.deleteExpired', async () => {
      sessionModel.deleteExpired.mockResolvedValue(5);

      await service.cleanupExpiredSessions();

      expect(sessionModel.deleteExpired).toHaveBeenCalled();
    });

    it('non lancia se non ci sono sessioni scadute (deleted = 0)', async () => {
      sessionModel.deleteExpired.mockResolvedValue(0);

      await expect(service.cleanupExpiredSessions()).resolves.not.toThrow();
    });
  });
});
