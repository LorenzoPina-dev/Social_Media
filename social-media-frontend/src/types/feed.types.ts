import { Post } from './post.types';
import { Profile } from './user.types';

// ── Legacy feed (post-service) ─────────────────────────────────────────────
export interface FeedPost extends Post {
  author: Profile;
  liked_by_user: boolean;
  saved_by_user: boolean;
  likes_count: number;
  comments_count: number;
  shares_count: number;
}

export interface FeedResponse {
  items: FeedPost[];
  cursor?: string;
  has_more: boolean;
}

export interface TrendingFeedResponse {
  items: FeedPost[];
  period: 'day' | 'week' | 'month';
  generated_at: string;
}

export interface FeedSize {
  size: number;
}

// ── Feed-service (denormalized, with author embedded) ──────────────────────

export interface FeedAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  verified: boolean;
}

export interface FeedPostSummary {
  id: string;
  userId: string;
  content: string;
  imageUrl: string | null;
  imageType: string | null;
  mediaUrls: string[];
  mediaTypes: string[];
  visibility: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  publishedAt: string;
  createdAt: string;
  author: FeedAuthor | null;
}

/** Single item returned by GET /api/v1/feed */
export interface FeedItem {
  postId: string;
  score: number;
  post: FeedPostSummary | undefined;
}

/** Response envelope from the feed-service */
export interface FeedServiceResponse {
  items: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}
