import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPost, getPost, listUserPosts } from '../api/posts';

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => createPost(payload),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['posts', 'feed'] });
    },
  });
}

export function usePost(postId: string | null) {
  return useQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost(postId!),
    enabled: !!postId,
  });
}

export function useUserPosts(userId: string, params?: { cursor?: string; limit?: number }) {
  return useQuery({
    queryKey: ['user_posts', userId, params],
    queryFn: () => listUserPosts(userId, params),
    enabled: !!userId,
  });
}
