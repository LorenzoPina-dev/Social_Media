/**
 * MFA Service Unit Tests
 */

import { MFAService } from '../../src/services/mfa.service';
import { MFAModel } from '../../src/models/mfa.model';
import { UserModel } from '../../src/models/user.model';
import { AuthProducer } from '../../src/kafka/producers/auth.producer';

// Mock dependencies
jest.mock('../../src/models/mfa.model');
jest.mock('../../src/models/user.model');
jest.mock('../../src/kafka/producers/auth.producer');
jest.mock('speakeasy');
jest.mock('qrcode');

// Import mocked modules
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

describe('MFAService', () => {
  let mfaService: MFAService;
  let mfaModel: jest.Mocked<MFAModel>;
  let userModel: jest.Mocked<UserModel>;
  let authProducer: jest.Mocked<AuthProducer>;

  beforeEach(() => {
    mfaModel = new MFAModel() as jest.Mocked<MFAModel>;
    userModel = new UserModel() as jest.Mocked<UserModel>;
    authProducer = new AuthProducer() as jest.Mocked<AuthProducer>;

    mfaService = new MFAService(mfaModel, userModel, authProducer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setupMFA', () => {
    const userId = '123';
    const mockUser = {
      id: userId,
      username: 'testuser',
      email: 'test@example.com',
      mfa_enabled: false,
    } as any;

    it('should setup MFA successfully', async () => {
      // Mock user
      userModel.findById.mockResolvedValue(mockUser);

      // Mock secret generation
      const mockSecret = {
        base32: 'TESTSECRET',
        otpauth_url: 'otpauth://totp/test',
      };
      (speakeasy.generateSecret as jest.Mock).mockReturnValue(mockSecret);

      // Mock MFA secret creation
      const mockMFASecret = {
        id: 'mfa-123',
        user_id: userId,
        secret: 'TESTSECRET',
        backup_codes: ['CODE1', 'CODE2', 'CODE3'],
      } as any;
      mfaModel.create.mockResolvedValue(mockMFASecret);

      // Mock QR code generation
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,test');

      // Execute
      const result = await mfaService.setupMFA(userId);

      // Assertions
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qr_code');
      expect(result).toHaveProperty('backup_codes');
      expect(result.backup_codes).toHaveLength(3);
      expect(userModel.findById).toHaveBeenCalledWith(userId);
      expect(mfaModel.create).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await expect(mfaService.setupMFA(userId)).rejects.toThrow('User not found');
    });

    it('should throw error if MFA already enabled', async () => {
      const userWithMFA = { ...mockUser, mfa_enabled: true };
      userModel.findById.mockResolvedValue(userWithMFA);

      await expect(mfaService.setupMFA(userId)).rejects.toThrow('MFA already enabled');
    });
  });

  describe('verifyAndEnableMFA', () => {
    const userId = '123';
    const code = '123456';

    it('should verify and enable MFA successfully', async () => {
      // Mock MFA secret
      const mockMFASecret = {
        id: 'mfa-123',
        user_id: userId,
        secret: 'TESTSECRET',
        backup_codes: ['CODE1', 'CODE2'],
      } as any;
      mfaModel.findByUserId.mockResolvedValue(mockMFASecret);

      // Mock TOTP verification
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      // Mock model methods
      mfaModel.verify.mockResolvedValue();
      userModel.enableMFA.mockResolvedValue();
      authProducer.publishMFAEnabled.mockResolvedValue();

      // Execute
      const result = await mfaService.verifyAndEnableMFA(userId, { code });

      // Assertions
      expect(result.success).toBe(true);
      expect(result.backup_codes).toHaveLength(2);
      expect(mfaModel.verify).toHaveBeenCalledWith(mockMFASecret.id);
      expect(userModel.enableMFA).toHaveBeenCalledWith(userId, mockMFASecret.secret);
      expect(authProducer.publishMFAEnabled).toHaveBeenCalled();
    });

    it('should throw error for invalid MFA code', async () => {
      const mockMFASecret = {
        id: 'mfa-123',
        secret: 'TESTSECRET',
      } as any;
      mfaModel.findByUserId.mockResolvedValue(mockMFASecret);

      // Mock TOTP verification failure
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      await expect(
        mfaService.verifyAndEnableMFA(userId, { code })
      ).rejects.toThrow('Invalid MFA code');
    });

    it('should throw error if MFA not set up', async () => {
      mfaModel.findByUserId.mockResolvedValue(null);

      await expect(
        mfaService.verifyAndEnableMFA(userId, { code })
      ).rejects.toThrow('MFA not set up');
    });
  });

  describe('verifyMFAToken', () => {
    const userId = '123';
    const code = '123456';

    it('should verify TOTP code successfully', async () => {
      const mockUser = {
        id: userId,
        mfa_enabled: true,
        mfa_secret: 'TESTSECRET',
      } as any;
      userModel.findById.mockResolvedValue(mockUser);

      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const result = await mfaService.verifyMFAToken(userId, code);

      expect(result).toBe(true);
    });

    it('should verify backup code successfully', async () => {
      const mockUser = {
        id: userId,
        mfa_enabled: true,
        mfa_secret: 'TESTSECRET',
      } as any;
      userModel.findById.mockResolvedValue(mockUser);

      // TOTP fails
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      // Backup code succeeds
      mfaModel.useBackupCode.mockResolvedValue(true);

      const result = await mfaService.verifyMFAToken(userId, code);

      expect(result).toBe(true);
      expect(mfaModel.useBackupCode).toHaveBeenCalledWith(userId, code);
    });

    it('should return false for invalid code', async () => {
      const mockUser = {
        id: userId,
        mfa_enabled: true,
        mfa_secret: 'TESTSECRET',
      } as any;
      userModel.findById.mockResolvedValue(mockUser);

      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);
      mfaModel.useBackupCode.mockResolvedValue(false);

      const result = await mfaService.verifyMFAToken(userId, code);

      expect(result).toBe(false);
    });
  });

  describe('disableMFA', () => {
    const userId = '123';
    const code = '123456';

    it('should disable MFA successfully', async () => {
      const mockUser = {
        id: userId,
        mfa_enabled: true,
        mfa_secret: 'TESTSECRET',
      } as any;
      userModel.findById.mockResolvedValue(mockUser);

      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      userModel.disableMFA.mockResolvedValue();
      mfaModel.delete.mockResolvedValue();

      await mfaService.disableMFA(userId, code);

      expect(userModel.disableMFA).toHaveBeenCalledWith(userId);
      expect(mfaModel.delete).toHaveBeenCalledWith(userId);
    });

    it('should throw error for invalid code', async () => {
      const mockUser = {
        id: userId,
        mfa_enabled: true,
        mfa_secret: 'TESTSECRET',
      } as any;
      userModel.findById.mockResolvedValue(mockUser);

      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);
      mfaModel.useBackupCode.mockResolvedValue(false);

      await expect(mfaService.disableMFA(userId, code)).rejects.toThrow('Invalid MFA code');
    });
  });

  describe('getMFAStatus', () => {
    const userId = '123';

    it('should return disabled status', async () => {
      const mockUser = {
        id: userId,
        mfa_enabled: false,
      } as any;
      userModel.findById.mockResolvedValue(mockUser);

      const result = await mfaService.getMFAStatus(userId);

      expect(result).toEqual({
        enabled: false,
        verified: false,
        backup_codes_remaining: 0,
      });
    });

    it('should return enabled status with backup codes', async () => {
      const mockUser = {
        id: userId,
        mfa_enabled: true,
      } as any;
      userModel.findById.mockResolvedValue(mockUser);

      const mockMFASecret = {
        verified_at: new Date(),
        backup_codes: ['CODE1', 'CODE2', 'CODE3'],
      } as any;
      mfaModel.findByUserId.mockResolvedValue(mockMFASecret);

      const result = await mfaService.getMFAStatus(userId);

      expect(result).toEqual({
        enabled: true,
        verified: true,
        backup_codes_remaining: 3,
      });
    });
  });
});
