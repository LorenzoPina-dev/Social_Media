import { useState, useCallback, useEffect, useRef } from 'react';
import { getPersonalisedFeed } from '@/api/feed';
import { FeedItem } from '@/types/feed.types';
import { useInfiniteScroll } from './useInfiniteScroll';
import { useAuth } from './useAuth';
import { unwrapData } from '@/api/envelope';

export const useFeed = (_initialParams?: Record<string, unknown>) => {
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { isAuthenticated } = useAuth();

  const cursorRef = useRef<string | null>(null);

  const loadPosts = useCallback(async (reset = false) => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const currentCursor = reset ? undefined : cursorRef.current ?? undefined;

      const response = await getPersonalisedFeed({
        cursor: currentCursor,
        limit: 10,
      });

      // Envelope: { success: true, data: { items, nextCursor, hasMore, total } }
      const payload = unwrapData<{
        items: FeedItem[];
        nextCursor: string | null;
        hasMore: boolean;
        total: number;
      }>(response.data);

      const newItems: FeedItem[] = Array.isArray(payload?.items) ? payload.items : [];

      // Filtra item senza dati post (post cancellati / non ancora in Redis)
      const validItems = newItems.filter((item) => !!item.post);

      const newCursor: string | null = payload?.nextCursor ?? null;
      const newHasMore: boolean =
        typeof payload?.hasMore === 'boolean' ? payload.hasMore : !!newCursor;

      cursorRef.current = newCursor;
      setPosts((prev) => (reset ? validItems : [...prev, ...validItems]));
      setCursor(newCursor);
      setHasMore(newHasMore);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  // Caricamento iniziale
  useEffect(() => {
    if (isAuthenticated) {
      cursorRef.current = null;
      loadPosts(true);
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      await loadPosts();
    }
  }, [loadPosts, hasMore, isLoading]);

  const { lastElementRef } = useInfiniteScroll(loadMore, hasMore);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    cursorRef.current = null;
    setCursor(null);
    setHasMore(true);
    loadPosts(true);
  }, [loadPosts]);

  const removePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((item) => item.postId !== postId));
  }, []);

  const updatePost = useCallback((postId: string, updates: Partial<FeedItem>) => {
    setPosts((prev) =>
      prev.map((item) => (item.postId === postId ? { ...item, ...updates } : item))
    );
  }, []);

  const addPost = useCallback((newItem: FeedItem) => {
    setPosts((prev) => [newItem, ...prev]);
  }, []);

  // Ascolta l'evento globale per il refresh
  useEffect(() => {
    const handleFeedRefresh = () => {
      cursorRef.current = null;
      setCursor(null);
      setHasMore(true);
      loadPosts(true);
    };
    window.addEventListener('feed:refresh', handleFeedRefresh);
    return () => window.removeEventListener('feed:refresh', handleFeedRefresh);
  }, [loadPosts]);

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
