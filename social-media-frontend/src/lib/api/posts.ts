import api from './axios';

export interface CreatePostPayload {
  content: string;
  media_urls?: string[];
  media_types?: ('image' | 'video')[];
  visibility?: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  scheduled_at?: string;
}

export async function createPost(payload: CreatePostPayload) {
  const resp = await api.post('/api/v1/posts', payload);
  return resp.data;
}

export async function getPost(postId: string) {
  const resp = await api.get(`/api/v1/posts/${postId}`);
  return resp.data;
}

export async function listUserPosts(userId: string, params?: { cursor?: string; limit?: number }) {
  const resp = await api.get(`/api/v1/users/${userId}/posts`, { params });
  return resp.data;
}

export async function getTrendingHashtags(limit?: number) {
  const resp = await api.get('/api/v1/posts/trending/hashtags', { params: { limit } });
  return resp.data;
}
