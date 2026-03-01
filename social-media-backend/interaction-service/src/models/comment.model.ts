/**
 * Comment Model — Data access for `comments` + `comment_closure` tables
 *
 * Uses the Closure Table pattern for nested comments (max depth = 3).
 *
 * Every public query JOINs `users` so that the response already includes
 * the author's public profile (username, display_name, avatar_url, verified).
 * This avoids a round-trip to user-service at read time.
 */

import { getDatabase } from '../config/database';
import { Comment, CommentWithReplies, CreateCommentDto } from '../types';

// Shape returned by the JOIN — flat row before we reshape
interface CommentRow extends Comment {
  u_username: string;
  u_display_name: string | null;
  u_avatar_url: string | null;
  u_verified: boolean;
}

/** Reshape a flat joined row into Comment + user sub-object */
function toComment(row: CommentRow): CommentWithReplies {
  return {
    id: row.id,
    post_id: row.post_id,
    user_id: row.user_id,
    parent_id: row.parent_id,
    content: row.content,
    like_count: row.like_count,
    depth: row.depth,
    moderation_status: row.moderation_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    is_liked: false,   // per-user flag — cannot be stored here, default false
    replies_count: 0,  // filled in after countReplies()
    replies: [],
    user: {
      id: row.user_id,
      username: row.u_username ?? 'utente',
      display_name: row.u_display_name ?? row.u_username ?? 'Utente',
      avatar_url: row.u_avatar_url ?? null,
      verified: row.u_verified ?? false,
    },
  } as unknown as CommentWithReplies;
}

export class CommentModel {
  private readonly table = 'comments';
  private readonly closureTable = 'comment_closure';

  /** Columns we always select — comments.* plus aliased user columns */
  private commentSelect = [
    'comments.*',
    'users.username        as u_username',
    'users.display_name    as u_display_name',
    'users.avatar_url      as u_avatar_url',
    'users.verified        as u_verified',
  ];

  async findById(id: string): Promise<Comment | null> {
    const db = getDatabase();
    const comment = await db(this.table)
      .where({ 'comments.id': id })
      .whereNull('comments.deleted_at')
      .first();
    return comment || null;
  }

  async create(data: CreateCommentDto, depth = 0): Promise<Comment> {
    const db = getDatabase();

    const [comment] = await db(this.table)
      .insert({
        post_id: data.post_id,
        user_id: data.user_id,
        parent_id: data.parent_id || null,
        content: data.content,
        like_count: 0,
        depth,
        moderation_status: 'APPROVED',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Populate closure table
    await this.insertClosure(comment.id, data.parent_id || null, db);

    return comment;
  }

  private async insertClosure(
    commentId: string,
    parentId: string | null,
    db: ReturnType<typeof getDatabase>
  ): Promise<void> {
    const rows: Array<{ ancestor_id: string; descendant_id: string; depth: number }> = [
      { ancestor_id: commentId, descendant_id: commentId, depth: 0 },
    ];

    if (parentId) {
      const ancestors = await db(this.closureTable)
        .where({ descendant_id: parentId })
        .select('ancestor_id', 'depth');

      for (const ancestor of ancestors) {
        rows.push({
          ancestor_id: ancestor.ancestor_id,
          descendant_id: commentId,
          depth: ancestor.depth + 1,
        });
      }
    }

    await db(this.closureTable).insert(rows);
  }

  async findByPost(
    postId: string,
    limit = 20,
    cursor?: string
  ): Promise<CommentWithReplies[]> {
    const db = getDatabase();

    let query = db(this.table)
      .leftJoin('users', 'comments.user_id', 'users.id')
      .where({ 'comments.post_id': postId, 'comments.depth': 0 })
      .whereNull('comments.deleted_at')
      .orderBy('comments.created_at', 'asc')
      .limit(limit)
      .select(this.commentSelect);

    if (cursor) {
      query = query.where('comments.created_at', '>', new Date(cursor));
    }

    const rows = await query as unknown as CommentRow[];

    return Promise.all(
      rows.map(async (row) => {
        const comment = toComment(row);
        comment.replies_count = await this.countReplies(row.id);
        return comment;
      })
    );
  }

  async findReplies(parentId: string, limit = 20): Promise<CommentWithReplies[]> {
    const db = getDatabase();

    const rows = await db(this.table)
      .leftJoin('users', 'comments.user_id', 'users.id')
      .join('comment_closure', 'comments.id', 'comment_closure.descendant_id')
      .where({
        'comment_closure.ancestor_id': parentId,
        'comment_closure.depth': 1,
      })
      .whereNull('comments.deleted_at')
      .orderBy('comments.created_at', 'asc')
      .limit(limit)
      .select(this.commentSelect) as unknown as CommentRow[];

    return Promise.all(
      rows.map(async (row) => {
        const comment = toComment(row);
        comment.replies_count = await this.countReplies(row.id);
        return comment;
      })
    );
  }

  async countByPost(postId: string): Promise<number> {
    const db = getDatabase();
    const result = await db(this.table)
      .where({ post_id: postId })
      .whereNull('deleted_at')
      .count('id as count')
      .first();
    return parseInt(String(result?.count ?? 0), 10);
  }

  async countReplies(commentId: string): Promise<number> {
    const db = getDatabase();
    const result = await db(this.closureTable)
      .count('* as count')
      .where({ ancestor_id: commentId, depth: 1 })
      .first();
    return parseInt(String(result?.count ?? 0), 10);
  }

  async softDelete(id: string): Promise<boolean> {
    const db = getDatabase();
    const count = await db(this.table)
      .where({ id })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date(), updated_at: new Date() });
    return count > 0;
  }

  async softDeleteByPost(postId: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ post_id: postId })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date(), updated_at: new Date() });
  }

  async softDeleteByUser(userId: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date(), updated_at: new Date() });
  }

  async incrementLikeCount(id: string, direction: 1 | -1 = 1): Promise<void> {
    const db = getDatabase();
    if (direction === 1) {
      await db(this.table).where({ id }).increment('like_count', 1);
    } else {
      await db(this.table)
        .where({ id })
        .where('like_count', '>', 0)
        .decrement('like_count', 1);
    }
  }
}
