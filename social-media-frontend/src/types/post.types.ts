import { Profile } from './user.types';
import { Media } from './media.types';

export type Visibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
export type MediaType = 'image' | 'video';

export interface Post {
  id: string;
  content: string;
  media_urls: string[];
  media_types: MediaType[];
  visibility: Visibility;
  scheduled_at?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  user: Profile;
  media?: Media[];
  hashtags: string[];
  is_liked: boolean;
  is_saved: boolean;
  liked_by_user: boolean;
  saved_by_user: boolean;
  like_count: number;
  comment_count: number;
  share_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
}

export interface CreatePostRequest {
  content: string;
  media_urls?: string[];
  media_types?: MediaType[];
  visibility?: Visibility;
  scheduled_at?: string;
}

export interface UpdatePostRequest {
  content?: string;
  visibility?: Visibility;
}

export interface PostHistory {
  id: string;
  post_id: string;
  content: string;
  visibility: string;
  edited_at: string;
  edited_by: string;
}

export interface Hashtag {
  id: string;
  tag: string;
  count: number;
  post_count: number;
  last_used?: string;
}

export interface TrendingHashtag extends Hashtag {
  trend_velocity: number;
  posts_count_24h: number;
}
