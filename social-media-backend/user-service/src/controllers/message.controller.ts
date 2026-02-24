import { Request, Response } from 'express';
import { MessageService } from '../services/message.service';
import { logger } from '../utils/logger';

export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  async startConversation(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id as string | undefined;
    const targetUserId = req.body.userId as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const data = await this.messageService.startConversation(userId, targetUserId);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      if (error.message === 'User not found') {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      if (error.message === 'Cannot start conversation with yourself') {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error.message === 'Conversation not allowed') {
        res.status(403).json({ error: 'You can message only followers/following users' });
        return;
      }
      logger.error('Failed to start conversation', { error, userId, targetUserId });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getConversations(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id as string | undefined;
    const limitRaw = req.query.limit as string | undefined;
    const limit = limitRaw ? parseInt(limitRaw, 10) : 50;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const data = await this.messageService.getConversations(userId, limit);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Failed to get conversations', { error, userId });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getConversationDetails(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id as string | undefined;
    const { conversationId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const data = await this.messageService.getConversationDetails(userId, conversationId);
      res.json({ success: true, data });
    } catch (error: any) {
      if (error.message === 'Conversation not found') {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      if (error.message === 'Participant not found') {
        res.status(404).json({ error: 'Participant not found' });
        return;
      }
      logger.error('Failed to get conversation details', { error, userId, conversationId });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getMessages(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id as string | undefined;
    const { conversationId } = req.params;
    const limitRaw = req.query.limit as string | undefined;
    const limit = limitRaw ? parseInt(limitRaw, 10) : 100;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const data = await this.messageService.getMessages(userId, conversationId, limit);
      res.json({ success: true, data });
    } catch (error: any) {
      if (error.message === 'Conversation not found') {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      logger.error('Failed to get messages', { error, userId, conversationId });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async sendMessage(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id as string | undefined;
    const { conversationId } = req.params;
    const { content } = req.body as { content: string };

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const data = await this.messageService.sendMessage(userId, conversationId, content);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      if (error.message === 'Conversation not found') {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      if (error.message === 'Message content is required') {
        res.status(400).json({ error: 'Message content is required' });
        return;
      }
      logger.error('Failed to send message', { error, userId, conversationId });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async markAsRead(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id as string | undefined;
    const { conversationId, messageId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const updated = await this.messageService.markMessageAsRead(
        userId,
        conversationId,
        messageId
      );
      res.json({ success: true, data: { updated } });
    } catch (error: any) {
      if (error.message === 'Conversation not found') {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      logger.error('Failed to mark message as read', { error, userId, conversationId, messageId });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async deleteMessage(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id as string | undefined;
    const { messageId } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const deleted = await this.messageService.deleteMessage(userId, messageId);
      if (!deleted) {
        res.status(403).json({ error: 'Cannot delete this message' });
        return;
      }

      res.json({ success: true, data: { deleted: true } });
    } catch (error: any) {
      if (error.message === 'Message not found') {
        res.status(404).json({ error: 'Message not found' });
        return;
      }
      if (error.message === 'Conversation not found') {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      logger.error('Failed to delete message', { error, userId, messageId });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
