/**
 * AuthService – Unit Tests
 *
 * Tutti i mock sono dichiarati prima degli import (jest li hoista).
 * I test coprono ogni ramo di auth.service.ts.
 */

// ── mock infrastruttura ────────────────────────────────────────────────────
jest.mock('../../src/config/database', () => ({ getDatabase: jest.fn(), connectDatabase: jest.fn() }));
jest.mock('../../src/config/redis',    () => ({ getRedisClient: jest.fn(), connectRedis: jest.fn() }));
jest.mock('../../src/config/kafka',    () => ({ getKafkaProducer: jest.fn(), connectKafka: jest.fn() }));
jest.mock('../../src/utils/logger',    () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/utils/metrics', () => ({
  metrics: { incrementCounter: jest.fn(), recordRequestDuration: jest.fn() },
}));

// ── mock modelli e servizi ─────────────────────────────────────────────────
jest.mock('../../src/models/user.model');
jest.mock('../../src/models/session.model');
jest.mock('../../src/services/jwt.service');
jest.mock('../../src/services/session.service');
jest.mock('../../src/kafka/producers/auth.producer');

import { AuthService }    from '../../src/services/auth.service';
import { UserModel }      from '../../src/models/user.model';
import { SessionModel }   from '../../src/models/session.model';
import { JWTService }     from '../../src/services/jwt.service';
import { SessionService } from '../../src/services/session.service';
import { AuthProducer }   from '../../src/kafka/producers/auth.producer';
import {
  User, Session, TokenPair,
  ConflictError, UnauthorizedError, ValidationError,
} from '../../src/types';

// ── fixture ────────────────────────────────────────────────────────────────
const ACTIVE_USER: User = {
  id:            'uid-001',
  username:      'johndoe',
  email:         'john@example.com',
  password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
  display_name:  'John Doe',
  verified:      true,
  mfa_enabled:   false,
  status:        'ACTIVE',
  created_at:    new Date('2024-01-01'),
  updated_at:    new Date('2024-01-01'),
};

const MOCK_TOKENS: TokenPair = {
  access_token:  'eyJ.mock.access',
  refresh_token: 'eyJ.mock.refresh',
  expires_in:    900,
};

const MOCK_SESSION: Session = {
  id:            'sess-001',
  user_id:       ACTIVE_USER.id,
  refresh_token: MOCK_TOKENS.refresh_token,
  created_at:    new Date(),
  last_activity: new Date(),
  expires_at:    new Date(Date.now() + 30 * 86_400_000),
};

const DECODED_TOKEN = {
  userId:      ACTIVE_USER.id,
  username:    ACTIVE_USER.username,
  email:       ACTIVE_USER.email,
  verified:    true,
  mfa_enabled: false,
  iat:         Math.floor(Date.now() / 1000),
  exp:         Math.floor(Date.now() / 1000) + 900,
  iss:         'auth-service',
};

// ─────────────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let userModel: jest.Mocked<UserModel>;
  let sessionModel: jest.Mocked<SessionModel>;
  let jwtService: jest.Mocked<JWTService>;
  let sessionService: jest.Mocked<SessionService>;
  let authProducer: jest.Mocked<AuthProducer>;

  beforeEach(() => {
    jest.clearAllMocks();

    userModel      = new UserModel()                  as jest.Mocked<UserModel>;
    sessionModel   = new SessionModel()               as jest.Mocked<SessionModel>;
    jwtService     = new JWTService()                 as jest.Mocked<JWTService>;
    sessionService = new SessionService(sessionModel) as jest.Mocked<SessionService>;
    authProducer   = new AuthProducer()               as jest.Mocked<AuthProducer>;

    service = new AuthService(
      userModel, sessionModel, jwtService, sessionService, authProducer,
    );

    // default stubs
    jwtService.generateTokenPair.mockResolvedValue(MOCK_TOKENS);
    sessionService.createSession.mockResolvedValue(MOCK_SESSION);
    authProducer.publishUserRegistered.mockResolvedValue(undefined);
    authProducer.publishUserAuthenticated.mockResolvedValue(undefined);
  });

  // ══════════════════════════════════════════════════════════════════════════
  describe('register', () => {
    const DTO = {
      username: 'newuser', email: 'new@example.com',
      password: 'Secure1!Pass', display_name: 'New User',
    };

    beforeEach(() => {
      userModel.findByUsername.mockResolvedValue(null);
      userModel.findByEmail.mockResolvedValue(null);
      userModel.create.mockResolvedValue({
        ...ACTIVE_USER, username: DTO.username, email: DTO.email,
      });
    });

    it('restituisce { user, tokens } per dati validi', async () => {
      const result = await service.register(DTO);
      expect(result.user.username).toBe(DTO.username);
      expect(result.tokens).toEqual(MOCK_TOKENS);
    });

    it('controlla unicità di username e email', async () => {
      await service.register(DTO);
      expect(userModel.findByUsername).toHaveBeenCalledWith(DTO.username);
      expect(userModel.findByEmail).toHaveBeenCalledWith(DTO.email);
    });

    it('chiama userModel.create con il DTO ricevuto', async () => {
      await service.register(DTO);
      expect(userModel.create).toHaveBeenCalledWith(DTO);
    });

    it('chiama generateTokenPair con i dati dell\'utente creato', async () => {
      await service.register(DTO);
      expect(jwtService.generateTokenPair).toHaveBeenCalledWith(
        expect.objectContaining({ userId: ACTIVE_USER.id }),
      );
    });

    it('chiama createSession con il refresh_token', async () => {
      await service.register(DTO);
      expect(sessionService.createSession).toHaveBeenCalledWith(
        expect.any(String),
        MOCK_TOKENS.refresh_token,
      );
    });

    it('pubblica evento user_registered con type corretto', async () => {
      await service.register(DTO);
      expect(authProducer.publishUserRegistered).toHaveBeenCalledWith(
        expect.objectContaining({
          type:     'user_registered',
          username: DTO.username,
          email:    DTO.email,
        }),
      );
    });

    // ── ConflictError ────────────────────────────────────────────────────────
    it('lancia ConflictError se username già esistente', async () => {
      userModel.findByUsername.mockResolvedValue(ACTIVE_USER);
      await expect(service.register(DTO)).rejects.toBeInstanceOf(ConflictError);
    });

    it('lancia ConflictError se email già esistente', async () => {
      userModel.findByEmail.mockResolvedValue(ACTIVE_USER);
      await expect(service.register(DTO)).rejects.toBeInstanceOf(ConflictError);
    });

    it('non chiama create quando username è duplicato', async () => {
      userModel.findByUsername.mockResolvedValue(ACTIVE_USER);
      await expect(service.register(DTO)).rejects.toThrow();
      expect(userModel.create).not.toHaveBeenCalled();
    });

    // ── ValidationError — password ───────────────────────────────────────────
    it('lancia ValidationError: password < 8 caratteri', async () => {
      await expect(
        service.register({ ...DTO, password: 'Ab1!' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lancia ValidationError: nessuna maiuscola', async () => {
      await expect(
        service.register({ ...DTO, password: 'secure1!pass' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lancia ValidationError: nessuna minuscola', async () => {
      await expect(
        service.register({ ...DTO, password: 'SECURE1!PASS' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lancia ValidationError: nessun numero', async () => {
      await expect(
        service.register({ ...DTO, password: 'SecurePass!' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('lancia ValidationError: nessun carattere speciale', async () => {
      await expect(
        service.register({ ...DTO, password: 'Secure1Pass' })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('non chiama create se la password è debole', async () => {
      await expect(service.register({ ...DTO, password: 'weak' })).rejects.toThrow();
      expect(userModel.create).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  describe('login', () => {
    const DTO = { username: 'johndoe', password: 'Secure1!Pass' };

    beforeEach(() => {
      userModel.findByUsername.mockResolvedValue(ACTIVE_USER);
      userModel.verifyPassword.mockResolvedValue(true);
    });

    it('restituisce { user, tokens } per credenziali corrette', async () => {
      const result = await service.login(DTO);
      expect(result.user.id).toBe(ACTIVE_USER.id);
      expect(result.tokens).toEqual(MOCK_TOKENS);
      expect(result.mfa_required).toBeUndefined();
    });

    it('passa ipAddress e deviceInfo a createSession', async () => {
      await service.login(DTO, '10.0.0.1', 'Mozilla/5.0');
      expect(sessionService.createSession).toHaveBeenCalledWith(
        ACTIVE_USER.id, MOCK_TOKENS.refresh_token, '10.0.0.1', 'Mozilla/5.0',
      );
    });

    it('pubblica evento user_authenticated', async () => {
      await service.login(DTO);
      expect(authProducer.publishUserAuthenticated).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'user_authenticated', userId: ACTIVE_USER.id }),
      );
    });

    it('lancia UnauthorizedError se utente non trovato', async () => {
      userModel.findByUsername.mockResolvedValue(null);
      await expect(service.login(DTO)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('lancia UnauthorizedError per password errata', async () => {
      userModel.verifyPassword.mockResolvedValue(false);
      await expect(service.login(DTO)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('non genera token se la password è errata', async () => {
      userModel.verifyPassword.mockResolvedValue(false);
      await expect(service.login(DTO)).rejects.toThrow();
      expect(jwtService.generateTokenPair).not.toHaveBeenCalled();
    });

    it('lancia UnauthorizedError per account SUSPENDED', async () => {
      userModel.findByUsername.mockResolvedValue({ ...ACTIVE_USER, status: 'SUSPENDED' });
      await expect(service.login(DTO)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    // ── MFA ──────────────────────────────────────────────────────────────────
    it('restituisce mfa_required:true se MFA abilitato e codice non fornito', async () => {
      userModel.findByUsername.mockResolvedValue({
        ...ACTIVE_USER, mfa_enabled: true, mfa_secret: 'SECRET',
      });
      const result = await service.login(DTO);

      expect(result.mfa_required).toBe(true);
      expect(result.tokens.access_token).toBe('');
      expect(result.tokens.refresh_token).toBe('');
      expect(result.tokens.expires_in).toBe(0);
    });

    it('lancia UnauthorizedError per mfa_code errato', async () => {
      userModel.findByUsername.mockResolvedValue({
        ...ACTIVE_USER, mfa_enabled: true, mfa_secret: 'SECRET',
      });
      service.setMFAService({ verifyMFAToken: jest.fn().mockResolvedValue(false) } as any);

      await expect(
        service.login({ ...DTO, mfa_code: '000000' })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('completa il login con mfa_code corretto', async () => {
      userModel.findByUsername.mockResolvedValue({
        ...ACTIVE_USER, mfa_enabled: true, mfa_secret: 'SECRET',
      });
      service.setMFAService({ verifyMFAToken: jest.fn().mockResolvedValue(true) } as any);

      const result = await service.login({ ...DTO, mfa_code: '123456' });
      expect(result.tokens.access_token).toBe(MOCK_TOKENS.access_token);
      expect(result.mfa_required).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  describe('refreshToken', () => {
    const NEW_TOKENS: TokenPair = {
      access_token: 'new.access', refresh_token: 'new.refresh', expires_in: 900,
    };

    beforeEach(() => {
      jwtService.verifyRefreshToken.mockResolvedValue(DECODED_TOKEN as any);
      sessionModel.findByRefreshToken.mockResolvedValue(MOCK_SESSION);
      sessionModel.updateActivity.mockResolvedValue(undefined);
      sessionModel.delete.mockResolvedValue(undefined);
      userModel.findById.mockResolvedValue(ACTIVE_USER);
      jwtService.generateTokenPair.mockResolvedValue(NEW_TOKENS);
    });

    it('restituisce una nuova coppia di token', async () => {
      const result = await service.refreshToken(MOCK_TOKENS.refresh_token);
      expect(result).toEqual(NEW_TOKENS);
    });

    it('chiama verifyRefreshToken con il token corretto', async () => {
      await service.refreshToken(MOCK_TOKENS.refresh_token);
      expect(jwtService.verifyRefreshToken).toHaveBeenCalledWith(MOCK_TOKENS.refresh_token);
    });

    it('aggiorna l\'attività della sessione', async () => {
      await service.refreshToken(MOCK_TOKENS.refresh_token);
      expect(sessionModel.updateActivity).toHaveBeenCalledWith(MOCK_SESSION.id);
    });

    it('ruota la sessione: elimina la vecchia e crea una nuova', async () => {
      await service.refreshToken(MOCK_TOKENS.refresh_token);
      expect(sessionModel.delete).toHaveBeenCalledWith(MOCK_SESSION.id);
      expect(sessionService.createSession).toHaveBeenCalledTimes(1);
    });

    it('lancia UnauthorizedError se la sessione non esiste', async () => {
      sessionModel.findByRefreshToken.mockResolvedValue(null);
      await expect(
        service.refreshToken(MOCK_TOKENS.refresh_token)
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('lancia UnauthorizedError se il token JWT è invalido', async () => {
      jwtService.verifyRefreshToken.mockRejectedValue(
        new UnauthorizedError('Invalid refresh token')
      );
      await expect(service.refreshToken('bad-token')).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('lancia UnauthorizedError se l\'utente non esiste più nel DB', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(
        service.refreshToken(MOCK_TOKENS.refresh_token)
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  describe('logout', () => {
    it('elimina la sessione corrispondente al refresh token', async () => {
      sessionModel.findByRefreshToken.mockResolvedValue(MOCK_SESSION);
      sessionModel.delete.mockResolvedValue(undefined);

      await service.logout(MOCK_TOKENS.refresh_token);

      expect(sessionModel.findByRefreshToken).toHaveBeenCalledWith(MOCK_TOKENS.refresh_token);
      expect(sessionModel.delete).toHaveBeenCalledWith(MOCK_SESSION.id);
    });

    it('non lancia errore se la sessione non esiste (già scollegato)', async () => {
      sessionModel.findByRefreshToken.mockResolvedValue(null);
      await expect(service.logout('stale-token')).resolves.not.toThrow();
      expect(sessionModel.delete).not.toHaveBeenCalled();
    });

    it('rilancia errori DB durante la ricerca della sessione', async () => {
      sessionModel.findByRefreshToken.mockRejectedValue(new Error('DB error'));
      await expect(service.logout(MOCK_TOKENS.refresh_token)).rejects.toThrow('DB error');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  describe('logoutAll', () => {
    it('elimina tutte le sessioni dell\'utente', async () => {
      sessionModel.deleteAllForUser.mockResolvedValue(undefined);

      await service.logoutAll(ACTIVE_USER.id);

      expect(sessionModel.deleteAllForUser).toHaveBeenCalledWith(ACTIVE_USER.id);
    });

    it('rilancia errori DB', async () => {
      sessionModel.deleteAllForUser.mockRejectedValue(new Error('DB down'));
      await expect(service.logoutAll(ACTIVE_USER.id)).rejects.toThrow('DB down');
    });
  });
});
