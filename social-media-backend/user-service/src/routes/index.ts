/**
 * Routes Index
 * Setup all API routes
 */

import { Application } from 'express';
import { setupUserRoutes } from './user.routes';
import { setupFollowerRoutes } from './follower.routes';
import { setupGDPRRoutes } from './gdpr.routes';

import { UserController } from '../controllers/user.controller';
import { FollowerController } from '../controllers/follower.controller';
import { GDPRController } from '../controllers/gdpr.controller';

import { UserService } from '../services/user.service';
import { FollowerService } from '../services/follower.service';
import { GDPRService } from '../services/gdpr.service';
import { CacheService } from '../services/cache.service';

import { UserModel } from '../models/user.model';
import { FollowerModel } from '../models/follower.model';

import { UserProducer } from '../kafka/producers/user.producer';

import { logger } from '../utils/logger';

/**
 * Setup all routes
 */
export function setupRoutes(app: Application): void {
  // Initialize models
  const userModel = new UserModel();
  const followerModel = new FollowerModel();

  // Initialize infrastructure services
  const cacheService = new CacheService();
  const userProducer = new UserProducer();

  // Initialize domain services
  const userService = new UserService(
    userModel,
    cacheService,
    userProducer
  );

  const followerService = new FollowerService(
    followerModel,
    userService,
    cacheService,
    userProducer
  );

  const gdprService = new GDPRService(
    userService,
    followerService,
    userProducer
  );

  // Initialize controllers
  const userController = new UserController(userService);
  const followerController = new FollowerController(followerService);
  const gdprController = new GDPRController(gdprService);

  // Setup routes
  app.use('/api/v1/users', setupUserRoutes(userController));
  app.use('/api/v1/users', setupFollowerRoutes(followerController));
  app.use('/api/v1/users', setupGDPRRoutes(gdprController));

  // 404 handler
  app.use('*', (_, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      code: 'NOT_FOUND',
    });
  });

  logger.info('User routes configured successfully');
}
