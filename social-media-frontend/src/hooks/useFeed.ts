import { useState, useEffect, useCallback } from 'react';
import { getFeed } from '@/api/feed';
import { FeedPost } from '@/types/feed.types';
import { useInfiniteScroll } from './useInfiniteScroll';
import { useAuth } from './useAuth';

export const useFeed = (initialParams?: any) => {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { isAuthenticated } = useAuth();

  const loadPosts = useCallback(async (reset = false) => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getFeed({
        cursor: reset ? undefined : cursor || undefined,
        limit: 10,
        ...initialParams,
      });

      const newPosts = response.data.data;
      const newCursor = response.data.cursor;

      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      setCursor(newCursor || null);
      setHasMore(!!newCursor);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [cursor, isAuthenticated, initialParams]);

  const loadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      await loadPosts();
    }
  }, [loadPosts, hasMore, isLoading]);

  const { lastElementRef } = useInfiniteScroll(loadMore, hasMore);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setCursor(null);
    setHasMore(true);
    loadPosts(true);
  }, [loadPosts]);

  const removePost = useCallback((postId: string) => {
    setPosts(prev => prev.filter(post => post.id !== postId));
  }, []);

  const updatePost = useCallback((postId: string, updates: Partial<FeedPost>) => {
    setPosts(prev =>
      prev.map(post => (post.id === postId ? { ...post, ...updates } : post))
    );
  }, []);

  const addPost = useCallback((newPost: FeedPost) => {
    setPosts(prev => [newPost, ...prev]);
  }, []);

  return {
    posts,
    isLoading,
    isRefreshing,
    error,
    hasMore,
    lastElementRef,
    refresh,
    loadMore,
    removePost,
    updatePost,
    addPost,
  };
};