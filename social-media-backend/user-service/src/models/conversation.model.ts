import { getDatabase } from '../config/database';

export interface DbConversation {
  id: string;
  participant_a_id: string;
  participant_b_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface ListConversationRow extends DbConversation {
  participant_id: string;
  participant_username: string;
  participant_display_name: string | null;
  participant_avatar_url: string | null;
  participant_verified: boolean;
  last_message_id: string | null;
  last_message_content: string | null;
  last_message_sender_id: string | null;
  last_message_created_at: Date | null;
  last_message_read_at: Date | null;
  unread_count: string;
}

export class ConversationModel {
  private readonly table = 'conversations';

  normalizeParticipants(userId1: string, userId2: string): [string, string] {
    return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
  }

  async findByParticipants(userId1: string, userId2: string): Promise<DbConversation | null> {
    const [participantA, participantB] = this.normalizeParticipants(userId1, userId2);
    const db = getDatabase();
    const conversation = await db<DbConversation>(this.table)
      .where({ participant_a_id: participantA, participant_b_id: participantB })
      .first();

    return conversation || null;
  }

  async create(userId1: string, userId2: string): Promise<DbConversation> {
    const [participantA, participantB] = this.normalizeParticipants(userId1, userId2);
    const db = getDatabase();

    const [conversation] = await db<DbConversation>(this.table)
      .insert({
        participant_a_id: participantA,
        participant_b_id: participantB,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict(['participant_a_id', 'participant_b_id'])
      .ignore()
      .returning('*');

    if (conversation) return conversation;

    const existing = await this.findByParticipants(userId1, userId2);
    if (!existing) throw new Error('Failed to create conversation');
    return existing;
  }

  async findByIdForUser(conversationId: string, userId: string): Promise<DbConversation | null> {
    const db = getDatabase();
    const conversation = await db<DbConversation>(this.table)
      .where({ id: conversationId })
      .andWhere((q) => {
        q.where('participant_a_id', userId).orWhere('participant_b_id', userId);
      })
      .first();

    return conversation || null;
  }

  async touchConversation(conversationId: string): Promise<void> {
    const db = getDatabase();
    await db(this.table).where({ id: conversationId }).update({ updated_at: new Date() });
  }

  async listForUser(userId: string, limit: number): Promise<ListConversationRow[]> {
    const db = getDatabase();
    const participantExprSql = `CASE 
      WHEN c.participant_a_id = ? THEN c.participant_b_id
      ELSE c.participant_a_id
    END`;
    const participantExpr = db.raw(participantExprSql, [userId]);

    const rows = await db('conversations as c')
      .leftJoin('users as u', 'u.id', participantExpr)
      .leftJoin(
        db.raw(
          `LATERAL (
            SELECT id, content, sender_id, created_at, read_at
            FROM messages
            WHERE conversation_id = c.id
            ORDER BY created_at DESC
            LIMIT 1
          ) as lm ON TRUE`
        )
      )
      .select<ListConversationRow[]>(
        'c.id',
        'c.participant_a_id',
        'c.participant_b_id',
        'c.created_at',
        'c.updated_at',
        db.raw(`${participantExprSql} as participant_id`, [userId]),
        'u.username as participant_username',
        'u.display_name as participant_display_name',
        'u.avatar_url as participant_avatar_url',
        'u.verified as participant_verified',
        'lm.id as last_message_id',
        'lm.content as last_message_content',
        'lm.sender_id as last_message_sender_id',
        'lm.created_at as last_message_created_at',
        'lm.read_at as last_message_read_at',
        db.raw(
          `(SELECT COUNT(*)
            FROM messages m
            WHERE m.conversation_id = c.id
              AND m.sender_id <> ?
              AND m.read_at IS NULL) as unread_count`,
          [userId]
        )
      )
      .where((q) => {
        q.where('c.participant_a_id', userId).orWhere('c.participant_b_id', userId);
      })
      .orderBy('c.updated_at', 'desc')
      .limit(limit);

    return rows;
  }
}
