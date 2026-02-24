/**
 * Auth Controller
 * Handles HTTP requests for authentication operations
 */

import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';
import {
  CreateUserDto,
  LoginDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from '../types';

export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Register new user
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const data: CreateUserDto = req.body;

      logger.info('Register request', { username: data.username });

      const result = await this.authService.register(data);

      // Remove sensitive fields
      const sanitizedUser = this.sanitizeUser(result.user);

      res.status(201).json({
        success: true,
        data: {
          user: sanitizedUser,
          tokens: result.tokens,
        },
      });

      metrics.recordRequestDuration('register', Date.now() - startTime);
    } catch (error) {
      logger.error('Registration failed', { error });
      throw error;
    }
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const data: LoginDto = req.body;
      const ipAddress = req.ip;
      const deviceInfo = req.get('user-agent');

      logger.info('Login request', { username: data.username, ip: ipAddress });

      const result = await this.authService.login(data, ipAddress, deviceInfo);

      // Remove sensitive fields
      const sanitizedUser = this.sanitizeUser(result.user);

      res.json({
        success: true,
        data: {
          user: sanitizedUser,
          tokens: result.tokens,
          mfa_required: result.mfa_required,
        },
      });

      metrics.recordRequestDuration('login', Date.now() - startTime);
    } catch (error) {
      logger.error('Login failed', { error });
      throw error;
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        res.status(400).json({
          success: false,
          error: 'Refresh token is required',
          code: 'MISSING_REFRESH_TOKEN',
        });
        return;
      }

      const tokens = await this.authService.refreshToken(refresh_token);

      res.json({
        success: true,
        data: tokens,
      });
    } catch (error) {
      logger.error('Token refresh failed', { error });
      throw error;
    }
  }

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        res.status(400).json({
          success: false,
          error: 'Refresh token is required',
          code: 'MISSING_REFRESH_TOKEN',
        });
        return;
      }

      await this.authService.logout(refresh_token);

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout failed', { error });
      throw error;
    }
  }

  /**
   * Logout from all devices
   * POST /api/v1/auth/logout-all
   * Requires authentication
   */
  async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      await this.authService.logoutAll(userId);

      res.json({
        success: true,
        message: 'Logged out from all devices successfully',
      });
    } catch (error) {
      logger.error('Logout all failed', { error });
      throw error;
    }
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const data: RequestPasswordResetDto = req.body;
      await this.authService.requestPasswordReset(data);

      res.json({
        success: true,
        message: 'If this email exists, password reset instructions have been sent',
      });
    } catch (error) {
      logger.error('Forgot password failed', { error });
      throw error;
    }
  }

  /**
   * Reset password
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const data: ResetPasswordDto = req.body;
      await this.authService.resetPassword(data);

      res.json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      logger.error('Reset password failed', { error });
      throw error;
    }
  }

  /**
   * Sanitize user object (remove sensitive fields)
   */
  private sanitizeUser(user: any): any {
    const { password_hash, mfa_secret, ...sanitized } = user;
    return sanitized;
  }
}
