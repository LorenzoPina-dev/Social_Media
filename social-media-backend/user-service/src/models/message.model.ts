import { getDatabase } from '../config/database';

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class MessageModel {
  private readonly table = 'messages';

  async listByConversation(conversationId: string, limit: number): Promise<DbMessage[]> {
    const db = getDatabase();
    return db<DbMessage>(this.table)
      .where({ conversation_id: conversationId })
      .orderBy('created_at', 'asc')
      .limit(limit);
  }

  async create(conversationId: string, senderId: string, content: string): Promise<DbMessage> {
    const db = getDatabase();
    const [message] = await db<DbMessage>(this.table)
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    return message;
  }

  async markAsRead(conversationId: string, messageId: string, readerId: string): Promise<boolean> {
    const db = getDatabase();
    const updated = await db(this.table)
      .where({
        id: messageId,
        conversation_id: conversationId,
      })
      .whereNot('sender_id', readerId)
      .whereNull('read_at')
      .update({
        read_at: new Date(),
        updated_at: new Date(),
      });

    return updated > 0;
  }

  async deleteByIdForSender(messageId: string, senderId: string): Promise<boolean> {
    const db = getDatabase();
    const deleted = await db(this.table)
      .where({ id: messageId, sender_id: senderId })
      .delete();

    return deleted > 0;
  }

  async findById(messageId: string): Promise<DbMessage | null> {
    const db = getDatabase();
    const message = await db<DbMessage>(this.table).where({ id: messageId }).first();
    return message || null;
  }
}
