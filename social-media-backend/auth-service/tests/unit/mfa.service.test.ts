/**
 * MFAService — Unit Tests
 *
 * Il service importa speakeasy come namespace (`import * as speakeasy`),
 * quindi il mock deve restituire un oggetto con le stesse proprietà.
 */

// ── mock PRIMA di qualsiasi import ────────────────────────────────────────
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(),
  totp: { verify: jest.fn() },
}));
jest.mock('qrcode', () => ({ toDataURL: jest.fn() }));

jest.mock('../../src/config/database', () => ({ getDatabase: jest.fn(), connectDatabase: jest.fn() }));
jest.mock('../../src/config/redis',    () => ({ getRedisClient: jest.fn(), connectRedis: jest.fn() }));
jest.mock('../../src/config/kafka',    () => ({ getKafkaProducer: jest.fn(), connectKafka: jest.fn() }));
jest.mock('../../src/utils/logger',    () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../../src/utils/metrics',   () => ({ metrics: { incrementCounter: jest.fn(), recordRequestDuration: jest.fn() } }));
jest.mock('../../src/models/mfa.model');
jest.mock('../../src/models/user.model');
jest.mock('../../src/kafka/producers/auth.producer');

import * as speakeasy from 'speakeasy';
import * as QRCode    from 'qrcode';
import { MFAService }   from '../../src/services/mfa.service';
import { MFAModel }     from '../../src/models/mfa.model';
import { UserModel }    from '../../src/models/user.model';
import { AuthProducer } from '../../src/kafka/producers/auth.producer';
import { User, MFASecret, ValidationError } from '../../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// Shorthand per i mock di speakeasy (namespace mock)
const mockGenerateSecret = speakeasy.generateSecret as jest.Mock;
const mockTotpVerify     = speakeasy.totp.verify    as jest.Mock;
const mockQrToDataURL    = QRCode.toDataURL          as jest.Mock;

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────
const USER_ID = 'uid-mfa-001';

const MOCK_USER: User = {
  id:            USER_ID,
  username:      'mfauser',
  email:         'mfa@example.com',
  password_hash: '$argon2id$hash',
  verified:      true,
  mfa_enabled:   false,
  status:        'ACTIVE',
  created_at:    new Date(),
  updated_at:    new Date(),
};

const BACKUP_CODES = Array.from({ length: 10 }, (_, i) => `CODE0${i + 1}`);

const MOCK_MFA_SECRET: MFASecret = {
  id:           'mfa-001',
  user_id:      USER_ID,
  secret:       'BASE32SECRET',
  backup_codes: BACKUP_CODES,
  created_at:   new Date(),
};

// ─────────────────────────────────────────────────────────────────────────────

describe('MFAService', () => {
  let service: MFAService;
  let mfaModel: jest.Mocked<MFAModel>;
  let userModel: jest.Mocked<UserModel>;
  let authProducer: jest.Mocked<AuthProducer>;

  beforeEach(() => {
    jest.clearAllMocks();

    mfaModel     = new MFAModel()     as jest.Mocked<MFAModel>;
    userModel    = new UserModel()    as jest.Mocked<UserModel>;
    authProducer = new AuthProducer() as jest.Mocked<AuthProducer>;

    service = new MFAService(mfaModel, userModel, authProducer);
    authProducer.publishMFAEnabled.mockResolvedValue(undefined);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('setupMFA', () => {
    beforeEach(() => {
      userModel.findById.mockResolvedValue(MOCK_USER);
      mockGenerateSecret.mockReturnValue({
        base32:      'BASE32SECRET',
        otpauth_url: 'otpauth://totp/Social%20Media%20(mfauser)?secret=BASE32SECRET',
      });
      mfaModel.create.mockResolvedValue(MOCK_MFA_SECRET);
      mockQrToDataURL.mockResolvedValue('data:image/png;base64,QR_DATA');
    });

    it('restituisce secret, qr_code e 10 backup_codes', async () => {
      const result = await service.setupMFA(USER_ID);

      expect(result.secret).toBe('BASE32SECRET');
      expect(result.qr_code).toBe('data:image/png;base64,QR_DATA');
      expect(result.backup_codes).toHaveLength(10);
    });

    it('chiama speakeasy.generateSecret con name e issuer corretti', async () => {
      await service.setupMFA(USER_ID);

      expect(mockGenerateSecret).toHaveBeenCalledWith(
        expect.objectContaining({
          name:   expect.stringContaining('mfauser'),
          issuer: expect.any(String),
          length: 32,
        }),
      );
    });

    it('chiama mfaModel.create con userId e secret base32', async () => {
      await service.setupMFA(USER_ID);
      expect(mfaModel.create).toHaveBeenCalledWith(USER_ID, 'BASE32SECRET');
    });

    it('genera il QR code dall\'otpauth_url', async () => {
      await service.setupMFA(USER_ID);
      expect(mockQrToDataURL).toHaveBeenCalledWith(
        expect.stringContaining('otpauth://totp/'),
      );
    });

    it('lancia ValidationError se l\'utente non esiste', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.setupMFA(USER_ID)).rejects.toBeInstanceOf(ValidationError);
    });

    it('lancia ValidationError se MFA è già abilitato', async () => {
      userModel.findById.mockResolvedValue({ ...MOCK_USER, mfa_enabled: true });
      await expect(service.setupMFA(USER_ID)).rejects.toBeInstanceOf(ValidationError);
    });

    it('non chiama mfaModel.create se l\'utente non esiste', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.setupMFA(USER_ID)).rejects.toThrow();
      expect(mfaModel.create).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('verifyAndEnableMFA', () => {
    const CODE = '123456';

    beforeEach(() => {
      mfaModel.findByUserId.mockResolvedValue(MOCK_MFA_SECRET);
      mockTotpVerify.mockReturnValue(true);
      mfaModel.verify.mockResolvedValue(undefined);
      userModel.enableMFA.mockResolvedValue(undefined);
    });

    it('restituisce { success: true, backup_codes } per codice valido', async () => {
      const result = await service.verifyAndEnableMFA(USER_ID, { code: CODE });

      expect(result.success).toBe(true);
      expect(result.backup_codes).toHaveLength(10);
    });

    it('chiama totp.verify con secret, encoding e window corretti', async () => {
      await service.verifyAndEnableMFA(USER_ID, { code: CODE });

      expect(mockTotpVerify).toHaveBeenCalledWith(
        expect.objectContaining({
          secret:   'BASE32SECRET',
          encoding: 'base32',
          token:    CODE,
          window:   1,
        }),
      );
    });

    it('chiama mfaModel.verify con l\'id del secret', async () => {
      await service.verifyAndEnableMFA(USER_ID, { code: CODE });
      expect(mfaModel.verify).toHaveBeenCalledWith(MOCK_MFA_SECRET.id);
    });

    it('chiama userModel.enableMFA con userId e secret', async () => {
      await service.verifyAndEnableMFA(USER_ID, { code: CODE });
      expect(userModel.enableMFA).toHaveBeenCalledWith(USER_ID, MOCK_MFA_SECRET.secret);
    });

    it('pubblica evento mfa_enabled', async () => {
      await service.verifyAndEnableMFA(USER_ID, { code: CODE });
      expect(authProducer.publishMFAEnabled).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'mfa_enabled', userId: USER_ID }),
      );
    });

    it('lancia ValidationError se il secret non è ancora configurato', async () => {
      mfaModel.findByUserId.mockResolvedValue(null);
      await expect(service.verifyAndEnableMFA(USER_ID, { code: CODE })).rejects.toBeInstanceOf(ValidationError);
    });

    it('lancia ValidationError per codice TOTP errato', async () => {
      mockTotpVerify.mockReturnValue(false);
      await expect(service.verifyAndEnableMFA(USER_ID, { code: '000000' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('non chiama enableMFA se il codice è errato', async () => {
      mockTotpVerify.mockReturnValue(false);
      await expect(service.verifyAndEnableMFA(USER_ID, { code: '000000' })).rejects.toThrow();
      expect(userModel.enableMFA).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('verifyMFAToken', () => {
    const MFA_USER = { ...MOCK_USER, mfa_enabled: true, mfa_secret: 'BASE32SECRET' };

    beforeEach(() => {
      userModel.findById.mockResolvedValue(MFA_USER);
    });

    it('restituisce true per codice TOTP valido', async () => {
      mockTotpVerify.mockReturnValue(true);
      expect(await service.verifyMFAToken(USER_ID, '123456')).toBe(true);
    });

    it('non controlla backup code se TOTP è valido', async () => {
      mockTotpVerify.mockReturnValue(true);
      await service.verifyMFAToken(USER_ID, '123456');
      expect(mfaModel.useBackupCode).not.toHaveBeenCalled();
    });

    it('prova backup code quando TOTP fallisce e restituisce true', async () => {
      mockTotpVerify.mockReturnValue(false);
      mfaModel.useBackupCode.mockResolvedValue(true);

      expect(await service.verifyMFAToken(USER_ID, 'CODE01')).toBe(true);
      expect(mfaModel.useBackupCode).toHaveBeenCalledWith(USER_ID, 'CODE01');
    });

    it('restituisce false se né TOTP né backup code sono validi', async () => {
      mockTotpVerify.mockReturnValue(false);
      mfaModel.useBackupCode.mockResolvedValue(false);

      expect(await service.verifyMFAToken(USER_ID, 'WRONG')).toBe(false);
    });

    it('restituisce false se l\'utente non esiste', async () => {
      userModel.findById.mockResolvedValue(null);
      expect(await service.verifyMFAToken(USER_ID, '123456')).toBe(false);
    });

    it('restituisce false se MFA non è abilitato', async () => {
      userModel.findById.mockResolvedValue(MOCK_USER); // mfa_enabled: false
      expect(await service.verifyMFAToken(USER_ID, '123456')).toBe(false);
    });

    it('restituisce false se mfa_secret è null', async () => {
      userModel.findById.mockResolvedValue({ ...MOCK_USER, mfa_enabled: true, mfa_secret: undefined });
      expect(await service.verifyMFAToken(USER_ID, '123456')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('disableMFA', () => {
    const MFA_USER = { ...MOCK_USER, mfa_enabled: true, mfa_secret: 'BASE32SECRET' };

    beforeEach(() => {
      userModel.findById.mockResolvedValue(MFA_USER);
      mockTotpVerify.mockReturnValue(true);
      userModel.disableMFA.mockResolvedValue(undefined);
      mfaModel.delete.mockResolvedValue(undefined);
    });

    it('disabilita MFA per un codice TOTP valido', async () => {
      await service.disableMFA(USER_ID, '123456');

      expect(userModel.disableMFA).toHaveBeenCalledWith(USER_ID);
      expect(mfaModel.delete).toHaveBeenCalledWith(USER_ID);
    });

    it('disabilita MFA usando un backup code valido', async () => {
      mockTotpVerify.mockReturnValue(false);
      mfaModel.useBackupCode.mockResolvedValue(true);

      await service.disableMFA(USER_ID, 'CODE01');

      expect(userModel.disableMFA).toHaveBeenCalledWith(USER_ID);
    });

    it('lancia ValidationError per codice errato', async () => {
      mockTotpVerify.mockReturnValue(false);
      mfaModel.useBackupCode.mockResolvedValue(false);

      await expect(service.disableMFA(USER_ID, '000000')).rejects.toBeInstanceOf(ValidationError);
    });

    it('non chiama disableMFA se il codice è sbagliato', async () => {
      mockTotpVerify.mockReturnValue(false);
      mfaModel.useBackupCode.mockResolvedValue(false);

      await expect(service.disableMFA(USER_ID, '000000')).rejects.toThrow();
      expect(userModel.disableMFA).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('regenerateBackupCodes', () => {
    const MFA_USER = { ...MOCK_USER, mfa_enabled: true, mfa_secret: 'BASE32SECRET' };
    const NEW_CODES = Array.from({ length: 10 }, (_, i) => `NEW0${i + 1}`);

    beforeEach(() => {
      userModel.findById.mockResolvedValue(MFA_USER);
      mockTotpVerify.mockReturnValue(true);
      mfaModel.regenerateBackupCodes.mockResolvedValue(NEW_CODES);
    });

    it('restituisce 10 nuovi backup codes per codice valido', async () => {
      const codes = await service.regenerateBackupCodes(USER_ID, '123456');

      expect(codes).toHaveLength(10);
      expect(codes).toEqual(NEW_CODES);
    });

    it('chiama mfaModel.regenerateBackupCodes con lo userId', async () => {
      await service.regenerateBackupCodes(USER_ID, '123456');
      expect(mfaModel.regenerateBackupCodes).toHaveBeenCalledWith(USER_ID);
    });

    it('lancia ValidationError per codice errato', async () => {
      mockTotpVerify.mockReturnValue(false);
      mfaModel.useBackupCode.mockResolvedValue(false);

      await expect(service.regenerateBackupCodes(USER_ID, '000000')).rejects.toBeInstanceOf(ValidationError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  describe('getMFAStatus', () => {
    it('restituisce { enabled:false, verified:false, backup_codes_remaining:0 } se MFA non attivo', async () => {
      userModel.findById.mockResolvedValue(MOCK_USER); // mfa_enabled: false

      const status = await service.getMFAStatus(USER_ID);

      expect(status).toEqual({ enabled: false, verified: false, backup_codes_remaining: 0 });
    });

    it('restituisce stato corretto con MFA attivo e verificato', async () => {
      userModel.findById.mockResolvedValue({ ...MOCK_USER, mfa_enabled: true });
      mfaModel.findByUserId.mockResolvedValue({
        ...MOCK_MFA_SECRET,
        verified_at:  new Date(),
        backup_codes: ['A', 'B', 'C'],
      });

      const status = await service.getMFAStatus(USER_ID);

      expect(status.enabled).toBe(true);
      expect(status.verified).toBe(true);
      expect(status.backup_codes_remaining).toBe(3);
    });

    it('restituisce verified:false se il secret non è ancora stato verificato', async () => {
      userModel.findById.mockResolvedValue({ ...MOCK_USER, mfa_enabled: true });
      mfaModel.findByUserId.mockResolvedValue({
        ...MOCK_MFA_SECRET,
        verified_at:  undefined,
        backup_codes: ['X'],
      });

      const status = await service.getMFAStatus(USER_ID);

      expect(status.verified).toBe(false);
    });

    it('lancia ValidationError se l\'utente non esiste', async () => {
      userModel.findById.mockResolvedValue(null);
      await expect(service.getMFAStatus(USER_ID)).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
