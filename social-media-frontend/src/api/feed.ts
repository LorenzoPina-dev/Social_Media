import { apiClient } from './client';
import { FeedResponse, TrendingFeedResponse, FeedServiceResponse } from '@/types/feed.types';
import { CursorParams } from '@/types/api.types';

/** Feed-service personalised feed — returns hydrated FeedItems with author + post data */
export const getPersonalisedFeed = async (params?: { cursor?: string; limit?: number }) => {
  return apiClient.get<FeedServiceResponse>('/api/v1/feed', { params });
};

/** Legacy feed via post-service (kept for compatibility) */
export const getFeed = async (params?: CursorParams) => {
  return apiClient.get<FeedResponse>('/api/v1/posts/feed', { params });
};

export const getUserFeed = async (userId: string, params?: CursorParams) => {
  return apiClient.get<FeedResponse>(`/api/v1/users/${userId}/posts`, { params });
};

export const getFeedSize = async () => {
  return apiClient.get<{ size: number }>('/api/v1/feed/size');
};

export const clearFeed = async () => {
  return apiClient.delete('/api/v1/feed');
};

export const getTrendingFeed = async (period: 'day' | 'week' | 'month' = 'day') => {
  return apiClient.get<TrendingFeedResponse>('/api/v1/feed/', {
    params: { period, limit: 24 },
  });
};

export const getHashtagFeed = async (tag: string, params?: CursorParams) => {
  return apiClient.get<FeedResponse>(`/api/v1/search/hashtag/${tag}`, { params });
};
