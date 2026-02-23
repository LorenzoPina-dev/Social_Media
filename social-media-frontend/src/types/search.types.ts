import { Post } from './post.types';
import { Profile } from './user.types';
import { Hashtag } from './post.types';

export interface SearchUsersParams {
  q: string;
  limit?: number;
  offset?: number;
  verified?: boolean;
}

export interface SearchPostsParams {
  q: string;
  limit?: number;
  offset?: number;
  hashtag?: string;
  from_date?: string;
  to_date?: string;
}

export interface SearchHashtagsParams {
  tag: string;
  limit?: number;
  offset?: number;
}

export interface AutocompleteParams {
  q: string;
  type?: 'user' | 'hashtag' | 'all';
  limit?: number;
}

export interface SearchResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

export interface TrendingHashtagsParams {
  limit?: number;
}