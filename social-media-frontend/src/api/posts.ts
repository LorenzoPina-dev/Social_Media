import { apiClient } from './client';
import {
  Post,
  CreatePostRequest,
  UpdatePostRequest,
  Hashtag,
  TrendingHashtag,
  PostHistory,
} from '@/types/post.types';
import { CursorParams, PaginatedResponse } from '@/types/api.types';

export const createPost = async (data: CreatePostRequest) => {
  return apiClient.post<Post>('/api/v1/posts', data);
};

export const getPost = async (postId: string) => {
  return apiClient.get<Post>(`/api/v1/posts/${postId}`);
};

export const updatePost = async (postId: string, data: UpdatePostRequest) => {
  return apiClient.put<Post>(`/api/v1/posts/${postId}`, data);
};

export const deletePost = async (postId: string) => {
  return apiClient.delete(`/api/v1/posts/${postId}`);
};

export const getPostHistory = async (postId: string) => {
  return apiClient.get<PostHistory[]>(`/api/v1/posts/${postId}/history`);
};

export const getUserPosts = async (userId: string, params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Post>>(`/api/v1/users/${userId}/posts`, {
    params,
  });
};

export const getTrendingHashtags = async (limit?: number) => {
  return apiClient.get<TrendingHashtag[]>('/api/v1/posts/trending/hashtags', {
    params: { limit },
  });
};

export const savePost = async (postId: string) => {
  return apiClient.post(`/api/v1/posts/${postId}/save`);
};

export const unsavePost = async (postId: string) => {
  return apiClient.delete(`/api/v1/posts/${postId}/save`);
};

export const getSavedPosts = async (params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Post>>('/api/v1/posts/saved', { params });
};