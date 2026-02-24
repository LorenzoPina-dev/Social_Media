import { apiClient } from './client';
import { PaginatedResponse, CursorParams } from '@/types/api.types';
import { Comment, Like, Share } from '@/types/interaction.types';

// Comments
export const getComments = async (postId: string, params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Comment>>(`/api/v1/posts/${postId}/comments`, { params });
};

export const getCommentThread = async (commentId: string) => {
  return apiClient.get<Comment[]>(`/api/v1/comments/${commentId}/replies`);
};

export const createComment = async (
  postId: string,
  payload: string | { content: string; parent_id?: string }
) => {
  const body = typeof payload === 'string' ? { content: payload } : payload;
  return apiClient.post<Comment>(`/api/v1/posts/${postId}/comments`, body);
};

// Alias for createComment if addComment is also used
export const addComment = createComment;

export const updateComment = async (commentId: string, content: string) => {
  return Promise.reject(new Error('Comment update endpoint is not implemented in backend'));
};

export const deleteComment = async (commentId: string) => {
  return apiClient.delete(`/api/v1/comments/${commentId}`);
};

export const likeComment = async (commentId: string) => {
  return apiClient.post(`/api/v1/comments/${commentId}/like`);
};

export const unlikeComment = async (commentId: string) => {
  return apiClient.delete(`/api/v1/comments/${commentId}/like`);
};

// Likes
export const getLikes = async (postId: string, params?: CursorParams) => {
  return apiClient.get<{ like_count: number; is_liked: boolean }>(`/api/v1/posts/${postId}/likes/count`, { params });
};

export const likePost = async (postId: string) => {
  return apiClient.post(`/api/v1/posts/${postId}/like`);
};

export const unlikePost = async (postId: string) => {
  return apiClient.delete(`/api/v1/posts/${postId}/like`);
};

// Shares
export const getShares = async (postId: string, params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Share>>(`/api/v1/posts/${postId}/shares`, { params });
};

export const sharePost = async (postId: string, comment?: string) => {
  return apiClient.post<Share>(`/api/v1/posts/${postId}/share`, { comment });
};
