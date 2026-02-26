import api from './axios';

export async function likePost(postId: string) {
  const resp = await api.post(`/api/v1/posts/${postId}/like`);
  return resp.data;
}

export async function unlikePost(postId: string) {
  const resp = await api.delete(`/api/v1/posts/${postId}/like`);
  return resp.data;
}

export async function getPostLikeCount(postId: string) {
  const resp = await api.get(`/api/v1/posts/${postId}/likes/count`);
  return resp.data;
}

export async function likeComment(commentId: string) {
  const resp = await api.post(`/api/v1/comments/${commentId}/like`);
  return resp.data;
}

export async function unlikeComment(commentId: string) {
  const resp = await api.delete(`/api/v1/comments/${commentId}/like`);
  return resp.data;
}
