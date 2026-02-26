import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createComment, fetchComments } from '../api/comments';

export function useCreateComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => createComment(postId, payload),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['comments', postId] });
      qc.invalidateQueries({ queryKey: ['post', postId] });
    },
  });
}

export function useComments(postId: string, params?: { cursor?: string; limit?: number }) {
  return useQuery({
    queryKey: ['comments', postId, params],
    queryFn: () => fetchComments(postId, params),
    enabled: !!postId,
  });
}
