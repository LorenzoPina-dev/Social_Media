/**
 * Test Fixtures — Post Service
 */

import { v4 as uuidv4 } from 'uuid';
import { Post, Hashtag, PostEditHistory } from '../../src/types';

export const createMockPost = (overrides?: Partial<Post>): Post => {
  const id = uuidv4();
  return {
    id,
    user_id: uuidv4(),
    content: 'Test post with #hashtag content',
    media_urls: null,
    media_types: null,
    visibility: 'PUBLIC',
    like_count: 0,
    comment_count: 0,
    share_count: 0,
    moderation_status: 'PENDING',
    is_scheduled: false,
    scheduled_at: null,
    published_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  };
};

export const createMockHashtag = (overrides?: Partial<Hashtag>): Hashtag => ({
  id: uuidv4(),
  tag: 'testtag',
  post_count: 1,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

export const createMockEditHistory = (postId: string, overrides?: Partial<PostEditHistory>): PostEditHistory => ({
  id: uuidv4(),
  post_id: postId,
  previous_content: 'Previous content of the post',
  edited_at: new Date(),
  ...overrides,
});

export const mockPosts = {
  publicPost: createMockPost({ visibility: 'PUBLIC', moderation_status: 'APPROVED' }),
  privatePost: createMockPost({ visibility: 'PRIVATE' }),
  pendingPost: createMockPost({ visibility: 'PUBLIC', moderation_status: 'PENDING' }),
  deletedPost: createMockPost({ deleted_at: new Date() }),
  scheduledPost: createMockPost({
    is_scheduled: true,
    scheduled_at: new Date(Date.now() + 3600_000),
    published_at: null,
  }),
  rejectedPost: createMockPost({ moderation_status: 'REJECTED' }),
  longContent: createMockPost({ content: 'A'.repeat(2001) }),
};

export const validCreatePostDto = {
  content: 'This is a valid post with #hashtag',
  visibility: 'PUBLIC' as const,
};

export const validUpdatePostDto = {
  content: 'Updated content with #newtag',
};

export const clearDatabase = async (db: { raw: (sql: string) => Promise<void> }): Promise<void> => {
  await db.raw('TRUNCATE post_edit_history, post_hashtags, hashtags, posts CASCADE');
};
