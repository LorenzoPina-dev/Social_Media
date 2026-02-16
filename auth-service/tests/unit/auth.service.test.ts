/**
 * Auth Service Unit Tests
 */

import { AuthService } from '../../src/services/auth.service';
import { UserModel } from '../../src/models/user.model';
import { SessionModel } from '../../src/models/session.model';
import { JWTService } from '../../src/services/jwt.service';
import { SessionService } from '../../src/services/session.service';
import { AuthProducer } from '../../src/kafka/producers/auth.producer';

// Mock dependencies
jest.mock('../../src/models/user.model');
jest.mock('../../src/models/session.model');
jest.mock('../../src/services/jwt.service');
jest.mock('../../src/services/session.service');
jest.mock('../../src/kafka/producers/auth.producer');

describe('AuthService', () => {
  let authService: AuthService;
  let userModel: jest.Mocked<UserModel>;
  let sessionModel: jest.Mocked<SessionModel>;
  let jwtService: jest.Mocked<JWTService>;
  let sessionService: jest.Mocked<SessionService>;
  let authProducer: jest.Mocked<AuthProducer>;

  beforeEach(() => {
    userModel = new UserModel() as jest.Mocked<UserModel>;
    sessionModel = new SessionModel() as jest.Mocked<SessionModel>;
    jwtService = new JWTService() as jest.Mocked<JWTService>;
    sessionService = new SessionService(sessionModel) as jest.Mocked<SessionService>;
    authProducer = new AuthProducer() as jest.Mocked<AuthProducer>;

    authService = new AuthService(
      userModel,
      sessionModel,
      jwtService,
      sessionService,
      authProducer
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'SecurePass123!',
      display_name: 'Test User',
    };

    it('should successfully register a new user', async () => {
      // Mock no existing users
      userModel.findByUsername.mockResolvedValue(null);
      userModel.findByEmail.mockResolvedValue(null);

      // Mock user creation
      const mockUser = {
        id: '123',
        username: registerData.username,
        email: registerData.email,
        password_hash: 'hashed',
        verified: false,
        mfa_enabled: false,
        status: 'ACTIVE' as const,
        created_at: new Date(),
        updated_at: new Date(),
      };
      userModel.create.mockResolvedValue(mockUser);

      // Mock token generation
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 900,
      };
      jwtService.generateTokenPair.mockResolvedValue(mockTokens);

      // Mock session creation
      sessionService.createSession.mockResolvedValue({} as any);

      // Mock event publishing
      authProducer.publishUserRegistered.mockResolvedValue();

      // Execute
      const result = await authService.register(registerData);

      // Assertions
      expect(result.user).toBeDefined();
      expect(result.tokens).toEqual(mockTokens);
      expect(userModel.findByUsername).toHaveBeenCalledWith(registerData.username);
      expect(userModel.findByEmail).toHaveBeenCalledWith(registerData.email);
      expect(userModel.create).toHaveBeenCalledWith(registerData);
      expect(jwtService.generateTokenPair).toHaveBeenCalled();
      expect(sessionService.createSession).toHaveBeenCalled();
      expect(authProducer.publishUserRegistered).toHaveBeenCalled();
    });

    it('should throw error if username already exists', async () => {
      userModel.findByUsername.mockResolvedValue({} as any);

      await expect(authService.register(registerData)).rejects.toThrow('Username already exists');
    });

    it('should throw error if email already exists', async () => {
      userModel.findByUsername.mockResolvedValue(null);
      userModel.findByEmail.mockResolvedValue({} as any);

      await expect(authService.register(registerData)).rejects.toThrow('Email already exists');
    });

    it('should throw error for weak password', async () => {
      userModel.findByUsername.mockResolvedValue(null);
      userModel.findByEmail.mockResolvedValue(null);

      const weakPasswordData = { ...registerData, password: 'weak' };

      await expect(authService.register(weakPasswordData)).rejects.toThrow();
    });
  });

  describe('login', () => {
    const loginData = {
      username: 'testuser',
      password: 'SecurePass123!',
    };

    it('should successfully login a user', async () => {
      // Mock user
      const mockUser = {
        id: '123',
        username: loginData.username,
        email: 'test@example.com',
        password_hash: 'hashed',
        verified: true,
        mfa_enabled: false,
        status: 'ACTIVE' as const,
        created_at: new Date(),
        updated_at: new Date(),
      };
      userModel.findByUsername.mockResolvedValue(mockUser);
      userModel.verifyPassword.mockResolvedValue(true);

      // Mock token generation
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 900,
      };
      jwtService.generateTokenPair.mockResolvedValue(mockTokens);

      // Mock session creation
      sessionService.createSession.mockResolvedValue({} as any);

      // Mock event publishing
      authProducer.publishUserAuthenticated.mockResolvedValue();

      // Execute
      const result = await authService.login(loginData);

      // Assertions
      expect(result.user).toBeDefined();
      expect(result.tokens).toEqual(mockTokens);
      expect(userModel.findByUsername).toHaveBeenCalledWith(loginData.username);
      expect(userModel.verifyPassword).toHaveBeenCalledWith(mockUser, loginData.password);
      expect(jwtService.generateTokenPair).toHaveBeenCalled();
      expect(sessionService.createSession).toHaveBeenCalled();
      expect(authProducer.publishUserAuthenticated).toHaveBeenCalled();
    });

    it('should throw error for non-existent user', async () => {
      userModel.findByUsername.mockResolvedValue(null);

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for invalid password', async () => {
      const mockUser = {
        id: '123',
        username: loginData.username,
        password_hash: 'hashed',
      } as any;
      userModel.findByUsername.mockResolvedValue(mockUser);
      userModel.verifyPassword.mockResolvedValue(false);

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for suspended user', async () => {
      const mockUser = {
        id: '123',
        username: loginData.username,
        password_hash: 'hashed',
        status: 'SUSPENDED' as const,
      } as any;
      userModel.findByUsername.mockResolvedValue(mockUser);
      userModel.verifyPassword.mockResolvedValue(true);

      await expect(authService.login(loginData)).rejects.toThrow('Account suspended');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const refreshToken = 'old-refresh-token';

      // Mock token verification
      const mockDecoded = {
        userId: '123',
        username: 'testuser',
        email: 'test@example.com',
        verified: true,
        mfa_enabled: false,
        iat: Date.now(),
        exp: Date.now() + 3600,
        iss: 'auth-service',
      };
      jwtService.verifyRefreshToken.mockResolvedValue(mockDecoded);

      // Mock session
      const mockSession = {
        id: 'session-123',
        user_id: '123',
        refresh_token: refreshToken,
      } as any;
      sessionModel.findByRefreshToken.mockResolvedValue(mockSession);
      sessionModel.updateActivity.mockResolvedValue();
      sessionModel.delete.mockResolvedValue();

      // Mock user
      const mockUser = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
      } as any;
      userModel.findById.mockResolvedValue(mockUser);

      // Mock new tokens
      const mockTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 900,
      };
      jwtService.generateTokenPair.mockResolvedValue(mockTokens);
      sessionService.createSession.mockResolvedValue({} as any);

      // Execute
      const result = await authService.refreshToken(refreshToken);

      // Assertions
      expect(result).toEqual(mockTokens);
      expect(jwtService.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(sessionModel.findByRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(userModel.findById).toHaveBeenCalledWith('123');
      expect(jwtService.generateTokenPair).toHaveBeenCalled();
    });

    it('should throw error for invalid session', async () => {
      const refreshToken = 'invalid-refresh-token';

      jwtService.verifyRefreshToken.mockResolvedValue({} as any);
      sessionModel.findByRefreshToken.mockResolvedValue(null);

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const refreshToken = 'refresh-token';
      const mockSession = {
        id: 'session-123',
        user_id: '123',
      } as any;

      sessionModel.findByRefreshToken.mockResolvedValue(mockSession);
      sessionModel.delete.mockResolvedValue();

      await authService.logout(refreshToken);

      expect(sessionModel.findByRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(sessionModel.delete).toHaveBeenCalledWith(mockSession.id);
    });
  });

  describe('logoutAll', () => {
    it('should successfully logout all sessions', async () => {
      const userId = '123';

      sessionModel.deleteAllForUser.mockResolvedValue();

      await authService.logoutAll(userId);

      expect(sessionModel.deleteAllForUser).toHaveBeenCalledWith(userId);
    });
  });
});
