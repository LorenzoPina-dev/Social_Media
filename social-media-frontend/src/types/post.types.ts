import { Profile } from './user.types';
import { Media } from './media.types';

export interface Post {
  id: string;
  content: string;
  media_urls?: string[];
  media_types?: ('image' | 'video')[];
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  scheduled_at?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  user?: Profile;
  media?: Media[];
}

export interface CreatePostRequest {
  content: string;
  media_urls?: string[];
  media_types?: ('image' | 'video')[];
  visibility?: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  scheduled_at?: string;
}

export interface UpdatePostRequest {
  content?: string;
  visibility?: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
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
  last_used: string;
}

export interface TrendingHashtag extends Hashtag {
  trend_velocity: number;
  posts_count_24h: number;
}