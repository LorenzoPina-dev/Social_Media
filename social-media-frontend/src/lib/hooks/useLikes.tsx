import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { likePost, unlikePost, getPostLikeCount } from '../api/likes';

export function useLikePost(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => likePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post', postId] });
      qc.invalidateQueries({ queryKey: ['comments', postId] });
      qc.invalidateQueries({ queryKey: ['posts', 'feed'] });
    },
  });
}

export function useUnlikePost(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unlikePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post', postId] });
      qc.invalidateQueries({ queryKey: ['comments', postId] });
      qc.invalidateQueries({ queryKey: ['posts', 'feed'] });
    },
  });
}

export function usePostLikeCount(postId: string) {
  return useQuery({
    queryKey: ['post_like_count', postId],
    queryFn: () => getPostLikeCount(postId),
    enabled: !!postId,
  });
}
