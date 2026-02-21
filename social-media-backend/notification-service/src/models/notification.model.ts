/**
 * Notification Model — Data access layer
 */

import { getDatabase } from '../config/database';
import { Notification, CreateNotificationDto } from '../types';

export class NotificationModel {
  private get db() {
    return getDatabase();
  }

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const [notification] = await this.db('notifications').insert(dto).returning('*');
    return notification as Notification;
  }

  async findById(id: string): Promise<Notification | undefined> {
    return this.db('notifications').where({ id }).first() as Promise<Notification | undefined>;
  }

  /**
   * Recupera notifiche paginata con cursor per un utente
   */
  async findByRecipient(
    recipientId: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<Notification[]> {
    let query = this.db('notifications')
      .where({ recipient_id: recipientId })
      .orderBy('created_at', 'desc')
      .limit(limit);

    if (cursor) {
      query = query.where('created_at', '<', new Date(Buffer.from(cursor, 'base64').toString('utf8')));
    }

    return query as Promise<Notification[]>;
  }

  async countUnread(recipientId: string): Promise<number> {
    const [{ count }] = await this.db('notifications')
      .where({ recipient_id: recipientId, read: false })
      .count('* as count');
    return parseInt(count as string, 10);
  }

  async markAsRead(id: string, recipientId: string): Promise<boolean> {
    const updated = await this.db('notifications')
      .where({ id, recipient_id: recipientId })
      .update({ read: true, read_at: new Date() });
    return updated > 0;
  }

  async markAllAsRead(recipientId: string): Promise<number> {
    return this.db('notifications')
      .where({ recipient_id: recipientId, read: false })
      .update({ read: true, read_at: new Date() });
  }

  async deleteByRecipient(recipientId: string): Promise<void> {
    await this.db('notifications').where({ recipient_id: recipientId }).delete();
  }

  /**
   * Controlla se esiste già una notifica dello stesso tipo (per dedup)
   */
  async findDuplicate(
    recipientId: string,
    actorId: string,
    type: string,
    entityId: string,
  ): Promise<Notification | undefined> {
    return this.db('notifications')
      .where({ recipient_id: recipientId, actor_id: actorId, type, entity_id: entityId })
      .first() as Promise<Notification | undefined>;
  }
}
