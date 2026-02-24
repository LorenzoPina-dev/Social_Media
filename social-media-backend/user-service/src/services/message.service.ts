import {
  ConversationModel,
  ListConversationRow,
} from '../models/conversation.model';
import { MessageModel, DbMessage } from '../models/message.model';
import { FollowerModel } from '../models/follower.model';
import { UserService } from './user.service';
import { UserProducer } from '../kafka/producers/user.producer';
import { User } from '../types';

export interface ConversationListItem {
  id: string;
  participant: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    verified: boolean;
  };
  lastMessage: {
    id: string;
    content: string;
    sender_id: string;
    created_at: Date;
    read_at: Date | null;
  } | null;
  unreadCount: number;
  updated_at: Date;
  created_at: Date;
}

export interface ConversationDetails {
  conversationId: string;
  participant: User;
}

export type MessageData = DbMessage;

export class MessageService {
  constructor(
    private readonly conversationModel: ConversationModel,
    private readonly messageModel: MessageModel,
    private readonly followerModel: FollowerModel,
    private readonly userService: UserService,
    private readonly userProducer: UserProducer
  ) {}

  private async canStartConversation(userId: string, targetUserId: string): Promise<boolean> {
    const [followsTarget, followedByTarget] = await Promise.all([
      this.followerModel.isFollowing(userId, targetUserId),
      this.followerModel.isFollowing(targetUserId, userId),
    ]);
    return followsTarget || followedByTarget;
  }

  async startConversation(userId: string, targetUserId: string): Promise<{ conversation_id: string }> {
    if (userId === targetUserId) {
      throw new Error('Cannot start conversation with yourself');
    }

    const targetUser = await this.userService.findById(targetUserId);
    if (!targetUser) {
      throw new Error('User not found');
    }

    const allowed = await this.canStartConversation(userId, targetUserId);
    if (!allowed) {
      throw new Error('Conversation not allowed');
    }

    const existing = await this.conversationModel.findByParticipants(userId, targetUserId);
    if (existing) {
      return { conversation_id: existing.id };
    }

    const created = await this.conversationModel.create(userId, targetUserId);
    return { conversation_id: created.id };
  }

  async getConversations(userId: string, limit: number): Promise<ConversationListItem[]> {
    const rows: ListConversationRow[] = await this.conversationModel.listForUser(userId, limit);

    return rows.map((row) => ({
      id: row.id,
      participant: {
        id: row.participant_id,
        username: row.participant_username,
        display_name: row.participant_display_name,
        avatar_url: row.participant_avatar_url,
        verified: row.participant_verified,
      },
      lastMessage: row.last_message_id
        ? {
            id: row.last_message_id,
            content: row.last_message_content || '',
            sender_id: row.last_message_sender_id || '',
            created_at: row.last_message_created_at || row.updated_at,
            read_at: row.last_message_read_at,
          }
        : null,
      unreadCount: parseInt(row.unread_count, 10) || 0,
      updated_at: row.updated_at,
      created_at: row.created_at,
    }));
  }

  async getConversationDetails(userId: string, conversationId: string): Promise<ConversationDetails> {
    const conversation = await this.conversationModel.findByIdForUser(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const participantId =
      conversation.participant_a_id === userId
        ? conversation.participant_b_id
        : conversation.participant_a_id;

    const participant = await this.userService.findById(participantId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    return {
      conversationId: conversation.id,
      participant,
    };
  }

  async getMessages(userId: string, conversationId: string, limit: number): Promise<MessageData[]> {
    const conversation = await this.conversationModel.findByIdForUser(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return this.messageModel.listByConversation(conversationId, limit);
  }

  async sendMessage(userId: string, conversationId: string, content: string): Promise<MessageData> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('Message content is required');
    }

    const conversation = await this.conversationModel.findByIdForUser(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const message = await this.messageModel.create(conversationId, userId, trimmed);
    await this.conversationModel.touchConversation(conversationId);

    const recipientId =
      conversation.participant_a_id === userId
        ? conversation.participant_b_id
        : conversation.participant_a_id;

    await this.userProducer.publishMessageSent({
      userId,
      recipientId,
      conversationId,
      messageId: message.id,
      content: message.content,
      timestamp: new Date().toISOString(),
    });

    return message;
  }

  async markMessageAsRead(
    userId: string,
    conversationId: string,
    messageId: string
  ): Promise<boolean> {
    const conversation = await this.conversationModel.findByIdForUser(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return this.messageModel.markAsRead(conversationId, messageId, userId);
  }

  async deleteMessage(userId: string, messageId: string): Promise<boolean> {
    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const conversation = await this.conversationModel.findByIdForUser(
      message.conversation_id,
      userId
    );
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const deleted = await this.messageModel.deleteByIdForSender(messageId, userId);
    if (deleted) {
      await this.conversationModel.touchConversation(message.conversation_id);
    }
    return deleted;
  }
}
