import { getDatabase } from '../config/database';

export interface SavedPostRecord {
  user_id: string;
  post_id: string;
  created_at: Date;
}

export class SavedPostModel {
  private readonly table = 'saved_posts';

  async save(userId: string, postId: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .insert({
        user_id: userId,
        post_id: postId,
        created_at: new Date(),
      })
      .onConflict(['user_id', 'post_id'])
      .ignore();
  }

  async unsave(userId: string, postId: string): Promise<void> {
    const db = getDatabase();
    await db(this.table)
      .where({
        user_id: userId,
        post_id: postId,
      })
      .delete();
  }

  async listByUser(
    userId: string,
    options: {
      cursor?: { created_at: string; post_id: string };
      limit?: number;
    } = {}
  ): Promise<SavedPostRecord[]> {
    const db = getDatabase();
    const limit = options.limit || 20;

    let query = db(this.table)
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .orderBy('post_id', 'desc')
      .limit(limit);

    if (options.cursor) {
      query = query.where(function () {
        this.where('created_at', '<', options.cursor!.created_at).orWhere(function () {
          this.where('created_at', '=', options.cursor!.created_at).andWhere(
            'post_id',
            '<',
            options.cursor!.post_id
          );
        });
      });
    }

    return query;
  }
}
