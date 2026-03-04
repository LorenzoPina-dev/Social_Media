import { Post } from '@/types/post.types';
import { FeedItem } from '@/types/feed.types';

/**
 * Adatta un Post (snake_case, post-service) in un FeedItem (camelCase, feed-service)
 * in modo da poter riusare FeedPost in PostDetailPage senza duplicare UI.
 */
export function postToFeedItem(post: Post): FeedItem {
  const user = (post as any).user;

  return {
    postId: post.id,
    score: 0,
    post: {
      id: post.id,
      userId: post.user_id,
      content: post.content ?? '',
      imageUrl: post.media_urls?.[0] ?? null,
      imageType: post.media_types?.[0] ?? null,
      mediaUrls: post.media_urls ?? [],
      mediaTypes: post.media_types ?? [],
      visibility: post.visibility ?? 'public',
      likeCount: post.like_count ?? (post as any).likes_count ?? 0,
      commentCount: post.comment_count ?? (post as any).comments_count ?? 0,
      shareCount: (post as any).share_count ?? (post as any).shares_count ?? 0,
      publishedAt: post.created_at,
      createdAt: post.created_at,
      author: user
        ? {
            id: user.id ?? post.user_id,
            username: user.username ?? '',
            displayName: user.display_name ?? user.username ?? '',
            avatarUrl: user.avatar_url ?? null,
            verified: user.verified ?? false,
          }
        : null,
    },
  };
}
