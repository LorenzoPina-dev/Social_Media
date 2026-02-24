import { useState, useCallback } from 'react';
import { Post } from '@/types/post.types';
import { getPost, createPost, updatePost, deletePost, savePost, unsavePost } from '@/api/posts';
import { unwrapData } from '@/api/envelope';
import toast from 'react-hot-toast';

export const usePost = (postId?: string) => {
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPost = useCallback(async () => {
    if (!postId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await getPost(postId);
      setPost(unwrapData<Post>(response.data));
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  const create = useCallback(async (data: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await createPost(data);
      const createdPost = unwrapData<Post>(response.data);
      setPost(createdPost);
      toast.success('Post creato con successo!');
      return createdPost;
    } catch (err) {
      setError(err as Error);
      toast.error('Errore durante la creazione del post');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const update = useCallback(async (id: string, data: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await updatePost(id, data);
      const updatedPost = unwrapData<Post>(response.data);
      setPost(updatedPost);
      toast.success('Post aggiornato!');
      return updatedPost;
    } catch (err) {
      setError(err as Error);
      toast.error('Errore durante l\'aggiornamento');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await deletePost(id);
      toast.success('Post eliminato');
    } catch (err) {
      setError(err as Error);
      toast.error('Errore durante l\'eliminazione');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleSave = useCallback(async (id: string) => {
    if (!post) return;
    
    setIsSaving(true);
    
    try {
      if (post.is_saved) {
        await unsavePost(id);
        setPost({ ...post, is_saved: false });
        toast.success('Post rimosso dai salvati');
      } else {
        await savePost(id);
        setPost({ ...post, is_saved: true });
        toast.success('Post salvato');
      }
    } catch (err) {
      toast.error('Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  }, [post]);

  return {
    post,
    isLoading,
    isSaving,
    error,
    fetchPost,
    create,
    update,
    delete: remove,
    toggleSave,
  };
};
