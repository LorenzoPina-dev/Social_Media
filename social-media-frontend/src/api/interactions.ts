import { apiClient } from './client';
import {
  Like,
  Comment,
  CreateCommentRequest,
  Share,
  LikesCount,
  SharesCount,
} from '@/types/interaction.types';
import { CursorParams, PaginatedResponse } from '@/types/api.types';

// Comments
export const getComments = async (postId: string, params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Comment>>(
    `/api/v1/posts/${postId}/comments`,
    { params }
  );
};

export const getComment = async (commentId: string) => {
  return apiClient.get<Comment>(`/api/v1/comments/${commentId}`);
};

export const getCommentReplies = async (commentId: string, params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Comment>>(
    `/api/v1/comments/${commentId}/replies`,
    { params }
  );
};

export const createComment = async (
  postId: string,
  data: CreateCommentRequest
) => {
  return apiClient.post<Comment>(`/api/v1/posts/${postId}/comments`, data);
};

export const deleteComment = async (commentId: string) => {
  return apiClient.delete(`/api/v1/comments/${commentId}`);
};

// Likes
export const likePost = async (postId: string) => {
  return apiClient.post(`/api/v1/posts/${postId}/like`);
};

export const unlikePost = async (postId: string) => {
  return apiClient.delete(`/api/v1/posts/${postId}/like`);
};

export const getPostLikesCount = async (postId: string) => {
  return apiClient.get<LikesCount>(`/api/v1/posts/${postId}/likes/count`);
};

export const likeComment = async (commentId: string) => {
  return apiClient.post(`/api/v1/comments/${commentId}/like`);
};

export const unlikeComment = async (commentId: string) => {
  return apiClient.delete(`/api/v1/comments/${commentId}/like`);
};

// Shares
export const sharePost = async (postId: string, comment?: string) => {
  return apiClient.post<Share>(`/api/v1/posts/${postId}/share`, { comment });
};

export const getSharesCount = async (postId: string) => {
  return apiClient.get<SharesCount>(`/api/v1/posts/${postId}/shares/count`);
};

export const getShares = async (postId: string, params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Share>>(`/api/v1/posts/${postId}/shares`, {
    params,
  });
};