import { useState, useCallback } from 'react';
import { Profile } from '@/types/user.types';
import { Post } from '@/types/post.types';
import { Hashtag } from '@/types/post.types';
import { searchUsers, searchPosts, searchHashtags } from '@/api/search';

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

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      clear();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [usersRes, postsRes, hashtagsRes] = await Promise.all([
        searchUsers({ q: query, limit: 10 }),
        searchPosts({ q: query, limit: 10 }),
        searchHashtags(query),
      ]);

      setUsers(usersRes.data?.data ?? usersRes.data?.items ?? usersRes.data ?? []);
      setPosts(postsRes.data?.data ?? postsRes.data?.items ?? postsRes.data ?? []);
      setHashtags(hashtagsRes.data?.data ?? hashtagsRes.data?.items ?? hashtagsRes.data ?? []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
