import { apiClient } from './client';
import { Profile } from '@/types/user.types';
import { Post } from '@/types/post.types';
import { Hashtag } from '@/types/post.types';
import { CursorParams, PaginatedResponse } from '@/types/api.types';
import { unwrapData } from './envelope';

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

export const searchUsers = async (params: SearchUsersParams) => {
  return apiClient.get<PaginatedResponse<Profile>>('/api/v1/search/users', {
    params,
  });
};

export const searchPosts = async (params: SearchPostsParams) => {
  return apiClient.get<PaginatedResponse<Post>>('/api/v1/search/posts', {
    params,
  });
};

export const searchHashtags = async (tag: string, params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Hashtag>>(`/api/v1/search/hashtag/${tag}`, {
    params,
  });
};

export const getAutocompleteSuggestions = async (
  q: string,
  type?: 'user' | 'hashtag' | 'all',
  limit?: number
) => {
  return apiClient.get('/api/v1/search/suggest', {
    params: { q, type, limit },
  });
};

export const getTrendingHashtags = async (limit?: number) => {
  return apiClient.get<Hashtag[]>('/api/v1/search/trending/hashtags', {
    params: { limit },
  });
};

export interface SuggestionItem {
  type?: 'user' | 'hashtag' | 'post' | 'all';
  text: string;
}

export const normalizeSuggestionItems = (payload: unknown): SuggestionItem[] => {
  const data = unwrapData<unknown>(payload);

  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      if (typeof item === 'string') {
        return { text: item };
      }

      if (
        item &&
        typeof item === 'object' &&
        'text' in item &&
        typeof (item as { text: unknown }).text === 'string'
      ) {
        const typed = item as { type?: SuggestionItem['type']; text: string };
        return { type: typed.type, text: typed.text };
      }

      return null;
    })
    .filter((item): item is SuggestionItem => item !== null);
};
