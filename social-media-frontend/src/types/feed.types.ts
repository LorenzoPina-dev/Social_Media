import { Post } from './post.types';
import { Profile } from './user.types';

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