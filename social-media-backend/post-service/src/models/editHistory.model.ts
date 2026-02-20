/**
 * Edit History Model — Data Access Layer
 */

import { getDatabase } from '../config/database';
import { PostEditHistory } from '../types';

export class EditHistoryModel {
  private readonly table = 'post_edit_history';

  /** Crea un record di storico */
  async create(postId: string, previousContent: string): Promise<PostEditHistory> {
    const db = getDatabase();
    const [record] = await db(this.table)
      .insert({
        post_id: postId,
        previous_content: previousContent,
        edited_at: new Date(),
      })
      .returning('*');
    return record as PostEditHistory;
  }

  /** Recupera lo storico edizioni di un post */
  async findByPostId(postId: string): Promise<PostEditHistory[]> {
    const db = getDatabase();
    return db(this.table)
      .where({ post_id: postId })
      .orderBy('edited_at', 'desc')
      .select('*') as unknown as PostEditHistory[];
  }
}
