import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

export function useInfiniteScroll(
  loadMore: () => Promise<void>,
  hasMore: boolean,
  options: UseInfiniteScrollOptions = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useRef<HTMLDivElement | null>(null);
  const { threshold = 0.8, rootMargin = '100px', enabled = true } = options;

  const handleObserver = useCallback(
    async (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoading && enabled) {
        setIsLoading(true);
        try {
          await loadMore();
        } catch (error) {
          console.error('Error loading more items:', error);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [loadMore, hasMore, isLoading, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    observerRef.current = new IntersectionObserver(handleObserver, {
      threshold,
      rootMargin,
    });

    if (lastElementRef.current) {
      observerRef.current.observe(lastElementRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver, enabled, threshold, rootMargin]);

  return { lastElementRef, isLoading };
}