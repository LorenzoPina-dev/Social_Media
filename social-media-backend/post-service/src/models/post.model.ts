/**
 * Post Model — Data Access Layer
 */

import { getDatabase } from '../config/database';
import { Post, CreatePostDto, UpdatePostDto, CursorData } from '../types';

export class PostModel {
  private readonly table = 'posts';

  /** Crea un nuovo post */
  async create(
    userId: string,
    dto: CreatePostDto & { moderation_status?: string },
  ): Promise<Post> {
    const db = getDatabase();
    const isScheduled = !!dto.scheduled_at;
    const [post] = await db(this.table)
      .insert({
        user_id: userId,
        content: dto.content,
        media_urls: dto.media_urls ? JSON.stringify(dto.media_urls) : null,
        media_types: dto.media_types ? JSON.stringify(dto.media_types) : null,
        visibility: dto.visibility || 'PUBLIC',
        like_count: 0,
        comment_count: 0,
        share_count: 0,
        moderation_status: dto.moderation_status || 'PENDING',
        is_scheduled: isScheduled,
        scheduled_at: dto.scheduled_at ? new Date(dto.scheduled_at) : null,
        published_at: isScheduled ? null : new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    return this.normalize(post);
  }

  /** Trova post per ID (esclude soft-deleted e rejected) */
  async findById(id: string): Promise<Post | null> {
    const db = getDatabase();
    const post = await db(this.table)
      .where({ id })
      .whereNull('deleted_at')
      .first();
    return post ? this.normalize(post) : null;
  }

  /** Trova post per ID inclusi i deleted (per operazioni admin/consumer) */
  async findByIdRaw(id: string): Promise<Post | null> {
    const db = getDatabase();
    const post = await db(this.table).where({ id }).first();
    return post ? this.normalize(post) : null;
  }

  /** Lista post di un utente con cursor pagination */
  async findByUserId(
    userId: string,
    options: {
      cursor?: CursorData;
      limit?: number;
      includePrivate?: boolean;
    } = {},
  ): Promise<Post[]> {
    const db = getDatabase();
    const limit = options.limit || 20;

    let query = db(this.table)
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .where('is_scheduled', false)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit);

    if (!options.includePrivate) {
      query = query.whereIn('visibility', ['PUBLIC', 'FOLLOWERS']);
    }

    if (options.cursor) {
      query = query.where(function () {
        this.where('created_at', '<', options.cursor!.created_at).orWhere(function () {
          this.where('created_at', '=', options.cursor!.created_at).andWhere(
            'id',
            '<',
            options.cursor!.id,
          );
        });
      });
    }

    const posts = await query;
    return posts.map((p: Record<string, unknown>) => this.normalize(p));
  }

  /** Aggiorna un post */
  async update(id: string, dto: UpdatePostDto): Promise<Post> {
    const db = getDatabase();
    const [post] = await db(this.table)
      .where({ id })
      .update({ ...dto, updated_at: new Date() })
      .returning('*');
    return this.normalize(post);
  }

  /** Soft delete un post */
  async softDelete(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table).where({ id }).update({ deleted_at: new Date() });
  }

  /** Soft delete tutti i post di un utente (GDPR) */
  async softDeleteAllByUser(userId: string): Promise<number> {
    const db = getDatabase();
    return db(this.table)
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date() });
  }

  /** Aggiorna moderation_status */
  async updateModerationStatus(
    id: string,
    status: string,
  ): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .update({ moderation_status: status, updated_at: new Date() });
  }

  /** Fetcha i post schedulati pronti da pubblicare */
  async findDueScheduledPosts(): Promise<Post[]> {
    const db = getDatabase();
    const posts = await db(this.table)
      .where({ is_scheduled: true })
      .whereNull('deleted_at')
      .where('scheduled_at', '<=', new Date())
      .select('*');
    return posts.map((p: Record<string, unknown>) => this.normalize(p));
  }

  /** Pubblica un post schedulato */
  async publishScheduled(id: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ id })
      .update({ is_scheduled: false, published_at: new Date(), updated_at: new Date() });
  }

  /** Incrementa un contatore (like_count, comment_count, share_count) */
  async incrementCounter(id: string, field: 'like_count' | 'comment_count' | 'share_count'): Promise<void> {
    const db = getDatabase();
    await db(this.table).where({ id }).increment(field, 1);
  }

  /** Decrementa un contatore */
  async decrementCounter(id: string, field: 'like_count' | 'comment_count' | 'share_count'): Promise<void> {
    const db = getDatabase();
    await db(this.table).where({ id }).where(field, '>', 0).decrement(field, 1);
  }

  /** Normalizza il record DB (parse array JSON da PostgreSQL) */
  private normalize(raw: Record<string, unknown>): Post {
    return {
      ...raw,
      media_urls: typeof raw.media_urls === 'string' ? JSON.parse(raw.media_urls) : raw.media_urls,
      media_types: typeof raw.media_types === 'string' ? JSON.parse(raw.media_types) : raw.media_types,
    } as unknown as Post;
  }
}
