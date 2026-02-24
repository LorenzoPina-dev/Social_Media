import { Router } from 'express';
import Joi from 'joi';
import { MessageController } from '../controllers/message.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody, validateQuery } from '../middleware/validation';

const startConversationSchema = Joi.object({
  userId: Joi.string().uuid().required(),
});

const sendMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required(),
});

const listQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(200).optional(),
});

export function setupMessageRoutes(messageController: MessageController): Router {
  const router = Router();

  router.post(
    '/conversations',
    requireAuth,
    validateBody(startConversationSchema),
    messageController.startConversation.bind(messageController)
  );

  router.get(
    '/conversations',
    requireAuth,
    validateQuery(listQuerySchema),
    messageController.getConversations.bind(messageController)
  );

  router.get(
    '/conversations/:conversationId',
    requireAuth,
    messageController.getConversationDetails.bind(messageController)
  );

  router.get(
    '/:conversationId',
    requireAuth,
    validateQuery(listQuerySchema),
    messageController.getMessages.bind(messageController)
  );

  router.post(
    '/:conversationId',
    requireAuth,
    validateBody(sendMessageSchema),
    messageController.sendMessage.bind(messageController)
  );

  router.post(
    '/:conversationId/read/:messageId',
    requireAuth,
    messageController.markAsRead.bind(messageController)
  );

  router.delete(
    '/:messageId',
    requireAuth,
    messageController.deleteMessage.bind(messageController)
  );

  return router;
}
