/**
 * Auth Service
 * Business logic for authentication operations
 */

import { UserModel } from '../models/user.model';
import { SessionModel } from '../models/session.model';
import { JWTService } from './jwt.service';
import { SessionService } from './session.service';
import { MFAService } from './mfa.service';
import { AuthProducer } from '../kafka/producers/auth.producer';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import {
  User,
  CreateUserDto,
  LoginDto,
  TokenPair,
  UnauthorizedError,
  ConflictError,
  ValidationError,
} from '../types';

export class AuthService {
  private mfaService?: MFAService;

  constructor(
    private userModel: UserModel,
    private sessionModel: SessionModel,
    private jwtService: JWTService,
    private sessionService: SessionService,
    private authProducer: AuthProducer
  ) {}

  /**
   * Set MFA service (to avoid circular dependency)
   */
  setMFAService(mfaService: MFAService): void {
    this.mfaService = mfaService;
  }

  /**
   * Register new user
   */
  async register(data: CreateUserDto): Promise<{ user: User; tokens: TokenPair }> {
    const startTime = Date.now();

    try {
      // Validate username and email uniqueness
      const existingUsername = await this.userModel.findByUsername(data.username);
      if (existingUsername) {
        throw new ConflictError('Username already exists');
      }

      const existingEmail = await this.userModel.findByEmail(data.email);
      if (existingEmail) {
        throw new ConflictError('Email already exists');
      }

      // Validate password strength
      this.validatePassword(data.password);

      // Create user
      const user = await this.userModel.create(data);

      // Generate tokens
      const tokens = await this.jwtService.generateTokenPair({
        userId: user.id,
        username: user.username,
        email: user.email,
        verified: user.verified,
        mfa_enabled: user.mfa_enabled,
      });

      // Create session
      await this.sessionService.createSession(user.id, tokens.refresh_token);

      // Publish event
      await this.authProducer.publishUserRegistered({
        type: 'user_registered',
        userId: user.id,
        username: user.username,
        email: user.email,
        timestamp: new Date(),
      });

      logger.info('User registered successfully', { userId: user.id });
      metrics.incrementCounter('auth_registration_success');
      metrics.recordRequestDuration('auth_register', Date.now() - startTime);

      return { user, tokens };
    } catch (error) {
      metrics.incrementCounter('auth_registration_failed');
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(data: LoginDto, ipAddress?: string, deviceInfo?: string): Promise<{ user: User; tokens: TokenPair; mfa_required?: boolean }> {
    const startTime = Date.now();

    try {
      // Find user
      const user = await this.userModel.findByUsername(data.username);
      if (!user) {
        metrics.incrementCounter('auth_login_failed');
        throw new UnauthorizedError('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await this.userModel.verifyPassword(user, data.password);
      if (!isValidPassword) {
        metrics.incrementCounter('auth_login_failed');
        logger.warn('Invalid password attempt', { userId: user.id });
        throw new UnauthorizedError('Invalid credentials');
      }

      // Check if user is suspended
      if (user.status === 'SUSPENDED') {
        throw new UnauthorizedError('Account suspended');
      }

      // Check MFA
      if (user.mfa_enabled) {
        if (!data.mfa_code) {
          // MFA required but not provided
          logger.info('MFA code required', { userId: user.id });
          return { 
            user, 
            tokens: { access_token: '', refresh_token: '', expires_in: 0 },
            mfa_required: true 
          };
        }

        // Verify MFA code
        if (this.mfaService) {
          const mfaValid = await this.mfaService.verifyMFAToken(user.id, data.mfa_code);
          if (!mfaValid) {
            metrics.incrementCounter('auth_login_failed');
            logger.warn('Invalid MFA code', { userId: user.id });
            throw new UnauthorizedError('Invalid MFA code');
          }
          logger.info('MFA verification successful', { userId: user.id });
        } else {
          logger.warn('MFA service not initialized');
        }
      }

      // Generate tokens
      const tokens = await this.jwtService.generateTokenPair({
        userId: user.id,
        username: user.username,
        email: user.email,
        verified: user.verified,
        mfa_enabled: user.mfa_enabled,
      });

      // Create session
      await this.sessionService.createSession(
        user.id,
        tokens.refresh_token,
        ipAddress,
        deviceInfo
      );

      // Publish event
      await this.authProducer.publishUserAuthenticated({
        type: 'user_authenticated',
        userId: user.id,
        timestamp: new Date(),
        ip_address: ipAddress,
        device_info: deviceInfo,
      });

      logger.info('User logged in successfully', { userId: user.id });
      metrics.incrementCounter('auth_login_success');
      metrics.recordRequestDuration('auth_login', Date.now() - startTime);

      return { user, tokens };
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) {
        metrics.incrementCounter('auth_login_error');
      }
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const decoded = await this.jwtService.verifyRefreshToken(refreshToken);

      // Find session
      const session = await this.sessionModel.findByRefreshToken(refreshToken);
      if (!session) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Update session activity
      await this.sessionModel.updateActivity(session.id);

      // Find user
      const user = await this.userModel.findById(decoded.userId);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Generate new tokens
      const tokens = await this.jwtService.generateTokenPair({
        userId: user.id,
        username: user.username,
        email: user.email,
        verified: user.verified,
        mfa_enabled: user.mfa_enabled,
      });

      // Update session with new refresh token
      await this.sessionModel.delete(session.id);
      await this.sessionService.createSession(user.id, tokens.refresh_token);

      logger.info('Token refreshed successfully', { userId: user.id });
      metrics.incrementCounter('auth_token_refresh_success');

      return tokens;
    } catch (error) {
      metrics.incrementCounter('auth_token_refresh_failed');
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      const session = await this.sessionModel.findByRefreshToken(refreshToken);
      if (session) {
        await this.sessionModel.delete(session.id);
        logger.info('User logged out', { userId: session.user_id });
      }
      metrics.incrementCounter('auth_logout_success');
    } catch (error) {
      logger.error('Logout failed', { error });
      throw error;
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId: string): Promise<void> {
    try {
      await this.sessionModel.deleteAllForUser(userId);
      logger.info('User logged out from all devices', { userId });
      metrics.incrementCounter('auth_logout_all_success');
    } catch (error) {
      logger.error('Logout all failed', { error });
      throw error;
    }
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      throw new ValidationError('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      throw new ValidationError('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      throw new ValidationError('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new ValidationError('Password must contain at least one special character');
    }
  }
}
