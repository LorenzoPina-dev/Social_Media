import { useState, useCallback } from 'react';
import { Comment } from '@/types/interaction.types';
import {
  getComments,
  createComment,
  deleteComment,
  likeComment,
  unlikeComment,
  getCommentThread,
} from '@/api/interactions';
import { useAuth } from './useAuth';
import toast from 'react-hot-toast';

export const useComments = (postId: string) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const { isAuthenticated } = useAuth();

  const fetchComments = useCallback(async (reset = false) => {
    if (!postId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await getComments(postId, {
        cursor: reset ? undefined : cursor || undefined,
        limit: 20,
      });
      
      const newComments = response.data.data;
      const newCursor = response.data.cursor;
      
      setComments(prev => reset ? newComments : [...prev, ...newComments]);
      setCursor(newCursor || null);
      setHasMore(!!newCursor);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [postId, cursor]);

  const addComment = useCallback(async (content: string, parentId?: string) => {
    if (!isAuthenticated) {
      toast.error('Devi essere loggato per commentare');
      return;
    }
    
    setIsSending(true);
    
    try {
      const response = await createComment(postId, { content, parent_id: parentId });
      
      const newComment = response.data;
      
      if (parentId) {
        // Aggiungi come risposta al commento padre
        setComments(prev =>
          prev.map(comment =>
            comment.id === parentId
              ? {
                  ...comment,
                  replies: [...(comment.replies || []), newComment],
                  reply_count: (comment.reply_count || 0) + 1,
                }
              : comment
          )
        );
      } else {
        // Aggiungi come commento root
        setComments(prev => [newComment, ...prev]);
      }
      
      toast.success('Commento aggiunto');
      return newComment;
    } catch (err) {
      toast.error('Errore durante l\'invio del commento');
      throw err;
    } finally {
      setIsSending(false);
    }
  }, [postId, isAuthenticated]);

  const removeComment = useCallback(async (commentId: string) => {
    if (!isAuthenticated) return;
    
    try {
      await deleteComment(commentId);
      
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Commento eliminato');
    } catch (err) {
      toast.error('Errore durante l\'eliminazione');
      throw err;
    }
  }, [isAuthenticated]);

  const toggleLike = useCallback(async (commentId: string) => {
    if (!isAuthenticated) {
      toast.error('Devi essere loggato');
      return;
    }
    
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    
    const wasLiked = comment.is_liked;
    
    // Optimistic update
    setComments(prev =>
      prev.map(c =>
        c.id === commentId
          ? {
              ...c,
              is_liked: !wasLiked,
              like_count: wasLiked ? c.like_count - 1 : c.like_count + 1,
            }
          : c
      )
    );
    
    try {
      if (wasLiked) {
        await unlikeComment(commentId);
      } else {
        await likeComment(commentId);
      }
    } catch (err) {
      // Rollback
      setComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? {
                ...c,
                is_liked: wasLiked,
                like_count: wasLiked ? c.like_count + 1 : c.like_count - 1,
              }
            : c
        )
      );
      toast.error('Errore durante il like');
    }
  }, [comments, isAuthenticated]);

  const loadReplies = useCallback(async (commentId: string) => {
    try {
      const response = await getCommentThread(commentId);
      
      setComments(prev =>
        prev.map(comment =>
          comment.id === commentId
            ? { ...comment, replies: response.data }
            : comment
        )
      );
    } catch (err) {
      console.error('Failed to load replies:', err);
    }
  }, []);

  return {
    comments,
    isLoading,
    isSending,
    error,
    hasMore,
    fetchComments,
    addComment,
    deleteComment: removeComment,
    toggleLike,
    loadReplies,
  };
};