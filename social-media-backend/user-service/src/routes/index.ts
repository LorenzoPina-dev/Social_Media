/**
 * Routes Index
 * Setup all API routes
 */

import { Application } from 'express';
import { setupUserRoutes } from './user.routes';
import { setupFollowerRoutes } from './follower.routes';
import { setupGDPRRoutes } from './gdpr.routes';
import { setupMessageRoutes } from './message.routes';

import { UserController } from '../controllers/user.controller';
import { FollowerController } from '../controllers/follower.controller';
import { GDPRController } from '../controllers/gdpr.controller';
import { MessageController } from '../controllers/message.controller';

import { UserService } from '../services/user.service';
import { FollowerService } from '../services/follower.service';
import { GDPRService } from '../services/gdpr.service';
import { CacheService } from '../services/cache.service';
import { MessageService } from '../services/message.service';

import { UserModel } from '../models/user.model';
import { FollowerModel } from '../models/follower.model';
import { PrivacyModel } from '../models/privacy.model';
import { ConversationModel } from '../models/conversation.model';
import { MessageModel } from '../models/message.model';

import { UserProducer } from '../kafka/producers/user.producer';

import { logger } from '../utils/logger';
import { fail } from '@social-media/shared/dist/utils/http';

/**
 * Setup all routes
 */
export function setupRoutes(app: Application): void {
  // Initialize models
  const userModel = new UserModel();
  const followerModel = new FollowerModel();
  const privacyModel = new PrivacyModel();
  const conversationModel = new ConversationModel();
  const messageModel = new MessageModel();

  // Initialize infrastructure services
  const cacheService = new CacheService();
  const userProducer = new UserProducer();

  // Initialize domain services
  const userService = new UserService(
    userModel,
    privacyModel,
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
  const messageService = new MessageService(
    conversationModel,
    messageModel,
    followerModel,
    userService,
    userProducer
  );

  // Initialize controllers
  const userController = new UserController(userService);
  const followerController = new FollowerController(followerService);
  const gdprController = new GDPRController(gdprService);
  const messageController = new MessageController(messageService);

  // Setup routes
  app.use('/api/v1/users', setupUserRoutes(userController));
  app.use('/api/v1/users', setupFollowerRoutes(followerController));
  app.use('/api/v1/users', setupGDPRRoutes(gdprController));
  app.use('/api/v1/messages', setupMessageRoutes(messageController));

  // 404 handler
  app.use('*', (_, res) => {
    fail(res, 404, 'NOT_FOUND', 'Route not found');
  });

  logger.info('User routes configured successfully');
}
