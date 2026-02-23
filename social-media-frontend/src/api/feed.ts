import { apiClient } from './client';
import { FeedPost, FeedResponse, TrendingFeedResponse } from '@/types/feed.types';
import { CursorParams } from '@/types/api.types';

export const getFeed = async (params?: CursorParams) => {
  return apiClient.get<FeedResponse>('/api/v1/feed', { params });
};

export const getUserFeed = async (userId: string, params?: CursorParams) => {
  return apiClient.get<FeedResponse>(`/api/v1/feed/user/${userId}`, { params });
};

export const getFeedSize = async () => {
  return apiClient.get<{ size: number }>('/api/v1/feed/size');
};

export const clearFeed = async () => {
  return apiClient.delete('/api/v1/feed');
};

export const getTrendingFeed = async (period: 'day' | 'week' | 'month' = 'day') => {
  return apiClient.get<TrendingFeedResponse>('/api/v1/feed/trending', {
    params: { period },
  });
};

export const getHashtagFeed = async (tag: string, params?: CursorParams) => {
  return apiClient.get<FeedResponse>(`/api/v1/feed/hashtag/${tag}`, { params });
};