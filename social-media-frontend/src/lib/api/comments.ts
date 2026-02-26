import api from './axios';

export interface CreateCommentPayload {
  content: string;
  parent_id?: string | null;
}

export async function createComment(postId: string, payload: CreateCommentPayload) {
  const resp = await api.post(`/api/v1/posts/${postId}/comments`, payload);
  return resp.data;
}

export async function fetchComments(postId: string, params?: { limit?: number; cursor?: string }) {
  const resp = await api.get(`/api/v1/posts/${postId}/comments`, { params });
  return resp.data;
}

export async function fetchReplies(commentId: string, params?: { limit?: number }) {
  const resp = await api.get(`/api/v1/comments/${commentId}/replies`, { params });
  return resp.data;
}

export async function deleteComment(commentId: string) {
  const resp = await api.delete(`/api/v1/comments/${commentId}`);
  return resp.data;
}
