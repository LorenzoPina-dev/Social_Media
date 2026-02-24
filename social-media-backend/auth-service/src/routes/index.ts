/**
 * Routes Index
 * Setup all API routes
 */

import { Application } from 'express';
import { setupAuthRoutes } from './auth.routes';
import { setupMFARoutes } from './mfa.routes';
import { AuthController } from '../controllers/auth.controller';
import { MFAController } from '../controllers/mfa.controller';

import { AuthService } from '../services/auth.service';
import { MFAService } from '../services/mfa.service';
import { JWTService } from '../services/jwt.service';
import { SessionService } from '../services/session.service';

import { UserModel } from '../models/user.model';
import { SessionModel } from '../models/session.model';
import { MFAModel } from '../models/mfa.model';
import { PasswordResetModel } from '../models/passwordReset.model';

import { AuthProducer } from '../kafka/producers/auth.producer';

import { logger } from '../utils/logger';
/**
 * Setup all routes
 */
export function setupRoutes(app: Application): void {
  // Initialize models
  const userModel = new UserModel();
  const sessionModel = new SessionModel();
  const mfaModel = new MFAModel();
  const passwordResetModel = new PasswordResetModel();

  // Initialize services
  const jwtService = new JWTService();
  const sessionService = new SessionService(sessionModel);
  const authProducer = new AuthProducer();

  const authService = new AuthService(
    userModel,
    sessionModel,
    passwordResetModel,
    jwtService,
    sessionService,
    authProducer
  );

  const mfaService = new MFAService(
    mfaModel,
    userModel,
    authProducer
  );

  // Set MFA service in Auth service (to avoid circular dependency)
  authService.setMFAService(mfaService);

  // Initialize controllers
  const authController = new AuthController(authService);
  const mfaController = new MFAController(mfaService);

  // Setup routes
  app.use('/api/v1/auth', setupAuthRoutes(authController));
  app.use('/api/v1/mfa', setupMFARoutes(mfaController));

  // 404 handler
  app.use('*', (_, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      code: 'NOT_FOUND',
    });
  });

  logger.info('Routes configured successfully');
}
