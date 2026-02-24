import { useState, useCallback } from 'react';
import { Profile } from '@/types/user.types';
import { Post } from '@/types/post.types';
import { Hashtag } from '@/types/post.types';
import {
  searchUsers as searchUsersByIndex,
  searchPosts,
  getAutocompleteSuggestions,
  normalizeSuggestionItems,
} from '@/api/search';
import { searchUsers as searchUsersByUserService } from '@/api/users';
import { unwrapItems } from '@/api/envelope';

interface UseSearchReturn {
  users: Profile[];
  posts: Post[];
  hashtags: Hashtag[];
  isLoading: boolean;
  error: Error | null;
  search: (query: string) => Promise<void>;
  clear: () => void;
}

export const useSearch = (): UseSearchReturn => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const buildHashtagResults = useCallback((query: string, postsData: Post[], suggestionTexts: string[]): Hashtag[] => {
    const normalizedQuery = query.trim().toLowerCase().replace(/^#/, '');
    const map = new Map<string, number>();

    for (const post of postsData) {
      if (!Array.isArray(post.hashtags)) continue;
      for (const rawTag of post.hashtags) {
        const tag = String(rawTag || '').trim().toLowerCase().replace(/^#/, '');
        if (!tag) continue;
        if (!normalizedQuery || tag.includes(normalizedQuery)) {
          map.set(tag, (map.get(tag) || 0) + 1);
        }
      }
    }

    for (const raw of suggestionTexts) {
      const tag = raw.trim().toLowerCase().replace(/^#/, '');
      if (!tag) continue;
      if (!normalizedQuery || tag.includes(normalizedQuery)) {
        map.set(tag, map.get(tag) || 0);
      }
    }

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, postCount]) => ({
        id: tag,
        tag,
        post_count: postCount,
        count: postCount,
      }));
  }, []);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      clear();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [indexedUsers, fallbackUsers, postsRes, hashtagsSuggestRes] = await Promise.allSettled([
        searchUsersByIndex({ q: query, limit: 10 }),
        searchUsersByUserService(query, 10),
        searchPosts({ q: query, limit: 10 }),
        getAutocompleteSuggestions(query, 'hashtag', 10),
      ]);

      const indexedUsersItems =
        indexedUsers.status === 'fulfilled' ? unwrapItems<Profile>(indexedUsers.value.data) : [];
      const fallbackUsersItems =
        fallbackUsers.status === 'fulfilled' ? unwrapItems<Profile>(fallbackUsers.value.data) : [];
      const mergedUsers = (indexedUsersItems.length > 0 ? indexedUsersItems : fallbackUsersItems).slice(0, 10);

      const postsItems = postsRes.status === 'fulfilled' ? unwrapItems<Post>(postsRes.value.data) : [];

      const hashtagsSuggestionTexts =
        hashtagsSuggestRes.status === 'fulfilled'
          ? normalizeSuggestionItems(hashtagsSuggestRes.value.data).map((item) => item.text)
          : [];

      setUsers(mergedUsers);
      setPosts(postsItems);
      setHashtags(buildHashtagResults(query, postsItems, hashtagsSuggestionTexts));
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [buildHashtagResults]);

  const clear = useCallback(() => {
    setUsers([]);
    setPosts([]);
    setHashtags([]);
    setError(null);
  }, []);

  return {
    users,
    posts,
    hashtags,
    isLoading,
    error,
    search,
    clear,
  };
};
