/**
 * Comment Model — Data access for `comments` + `comment_closure` tables
 *
 * Uses the Closure Table pattern for nested comments (max depth = 3).
 */

import { getDatabase } from '../config/database';
import { Comment, CommentWithReplies, CreateCommentDto } from '../types';

export class CommentModel {
  private readonly table = 'comments';
  private readonly closureTable = 'comment_closure';

  async findById(id: string): Promise<Comment | null> {
    const db = getDatabase();
    const comment = await db(this.table)
      .where({ id })
      .whereNull('deleted_at')
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
    // Self-reference (depth = 0)
    const rows: Array<{ ancestor_id: string; descendant_id: string; depth: number }> = [
      { ancestor_id: commentId, descendant_id: commentId, depth: 0 },
    ];

    if (parentId) {
      // Get all ancestors of the parent, then add this comment as a descendant of each
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
      .where({ post_id: postId, depth: 0 })
      .whereNull('deleted_at')
      .orderBy('created_at', 'asc')
      .limit(limit);

    if (cursor) {
      query = query.where('created_at', '>', new Date(cursor));
    }

    const comments = await query.select<Comment[]>('*');

    // Attach replies_count
    const withCounts: CommentWithReplies[] = await Promise.all(
      comments.map(async (c) => {
        const repliesCount = await this.countReplies(c.id);
        return { ...c, replies_count: repliesCount };
      })
    );

    return withCounts;
  }

  async findReplies(parentId: string, limit = 20): Promise<CommentWithReplies[]> {
    const db = getDatabase();
    const comments = await db(this.table)
      .join('comment_closure', 'comments.id', 'comment_closure.descendant_id')
    .where({
      'comment_closure.ancestor_id': parentId,
      'comment_closure.depth': 1  // Specify the table for depth
    })
    .whereNull('comments.deleted_at')
    .orderBy('comments.created_at', 'asc')
    .limit(limit)
    .select('comments.*');

    return Promise.all(
      comments.map(async (c) => ({
        ...c,
        replies_count: await this.countReplies(c.id),
      }))
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
    // Use closure table: find descendants at depth >= 1
    const result = await db(this.closureTable)
      .count('* as count')
    .where({ 
      ancestor_id: commentId,
      depth: 1  // Specify depth without table prefix since it's the only table
    })
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
