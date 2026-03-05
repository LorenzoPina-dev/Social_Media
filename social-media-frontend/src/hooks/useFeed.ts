import { useState, useCallback, useEffect, useRef } from 'react';
import { getPersonalisedFeed } from '@/api/feed';
import { FeedItem } from '@/types/feed.types';
import { useInfiniteScroll } from './useInfiniteScroll';
import { useAuth } from './useAuth';
import { useSocket } from './useSocket';
import { unwrapData } from '@/api/envelope';

export const useFeed = (_initialParams?: Record<string, unknown>) => {
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [newPostsBanner, setNewPostsBanner] = useState(0); // quanti nuovi post in attesa
  const { isAuthenticated } = useAuth();
  const { socket } = useSocket();

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
    setNewPostsBanner(0);
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

  // ── Listener CustomEvent browser (pubblicazione locale) ──────────────────────
  // Quando l'utente corrente pubblica un post, Feed.tsx dispatcha
  // window.CustomEvent('feed:refresh') e il feed si ricarica.
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

  // ── Listener Socket.io (eventi real-time dal backend) ────────────────────────
  useEffect(() => {
    if (!socket) return;

    /**
     * feed:new_post — un utente seguito ha pubblicato un nuovo post.
     *
     * Strategia: mostriamo un banner "N nuovi post" invece di ricaricare
     * silenziosamente, così l'utente non perde il suo scroll corrente.
     * Cliccando il banner si chiama refresh() che riporta in cima.
     */
    const onNewPost = (_data: { postId: string; authorId: string; visibility: string; timestamp: string }) => {
      setNewPostsBanner((prev) => prev + 1);
    };

    /**
     * feed:refresh — l'utente ha appena seguito qualcuno.
     * Ricarica il feed per includere i post recenti del nuovo seguito.
     */
    const onFeedRefresh = (_data: { reason: string; followedUserId?: string; timestamp: string }) => {
      cursorRef.current = null;
      setCursor(null);
      setHasMore(true);
      setNewPostsBanner(0);
      loadPosts(true);
    };

    socket.on('feed:new_post', onNewPost);
    socket.on('feed:refresh', onFeedRefresh);

    return () => {
      socket.off('feed:new_post', onNewPost);
      socket.off('feed:refresh', onFeedRefresh);
    };
  }, [socket, loadPosts]);

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
    /** Numero di nuovi post arrivati via WebSocket non ancora mostrati */
    newPostsBanner,
    /** Chiama refresh e azzera il banner */
    dismissBanner: refresh,
  };
};
