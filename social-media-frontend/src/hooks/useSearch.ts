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
import { getUsersBatch, searchUsers as searchUsersByUserService } from '@/api/users';
import { unwrapItems } from '@/api/envelope';

interface UseSearchReturn {
  users: Profile[];
  posts: Post[];
  hashtags: Hashtag[];
  isLoading: boolean;
  error: Error | null;
  search: (query: string, options?: { silent?: boolean }) => Promise<void>;
  setUserFollowState: (userId: string, isFollowing: boolean) => void;
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

  const search = useCallback(async (query: string, options?: { silent?: boolean }) => {
    if (!query.trim()) {
      clear();
      return;
    }

    if (!options?.silent) {
      setIsLoading(true);
    }
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
      const fallbackById = new Map(fallbackUsersItems.map((u) => [u.id, u]));
      const mergedUsersSource = indexedUsersItems.length > 0 ? indexedUsersItems : fallbackUsersItems;
      const mergedUsers = mergedUsersSource
        .map((user) => {
          const fallbackUser = fallbackById.get(user.id);
          const serverFollowersCount =
            fallbackUser?.follower_count ??
            fallbackUser?.followers_count ??
            user.follower_count ??
            user.followers_count ??
            0;

          return {
            ...user,
            is_following:
              typeof fallbackUser?.is_following === 'boolean'
                ? fallbackUser.is_following
                : user.is_following,
            follower_count: serverFollowersCount,
            followers_count: serverFollowersCount,
            post_count: fallbackUser?.post_count ?? fallbackUser?.posts_count ?? user.post_count,
          };
        })
        .slice(0, 10);

      // Hydrate counters from user-service canonical records to avoid
      // stale count mismatch between search card and profile page.
      const mergedUserIds = mergedUsers.map((u) => u.id).filter(Boolean);
      let hydratedUsers = mergedUsers;
      if (mergedUserIds.length > 0) {
        const batchRes = await getUsersBatch(mergedUserIds);
        const canonicalUsers = unwrapItems<Profile>(batchRes.data);
        const canonicalById = new Map(canonicalUsers.map((u) => [u.id, u]));
        hydratedUsers = mergedUsers.map((u) => {
          const canonical = canonicalById.get(u.id);
          if (!canonical) return u;
          const canonicalFollowerCount =
            canonical.follower_count ?? canonical.followers_count ?? u.follower_count ?? u.followers_count ?? 0;
          const canonicalPostCount =
            canonical.post_count ?? canonical.posts_count ?? u.post_count ?? u.posts_count ?? 0;
          return {
            ...u,
            follower_count: canonicalFollowerCount,
            followers_count: canonicalFollowerCount,
            post_count: canonicalPostCount,
            posts_count: canonicalPostCount,
          };
        });
      }

      const postsItems = postsRes.status === 'fulfilled' ? unwrapItems<Post>(postsRes.value.data) : [];

      const hashtagsSuggestionTexts =
        hashtagsSuggestRes.status === 'fulfilled'
          ? normalizeSuggestionItems(hashtagsSuggestRes.value.data).map((item) => item.text)
          : [];

      setUsers((prevUsers) => {
        const prevById = new Map(prevUsers.map((u) => [u.id, u]));
        return hydratedUsers.map((u) => {
          const prev = prevById.get(u.id);
          if (!prev) return u;

          const localFollowing =
            typeof prev.is_following === 'boolean' ? prev.is_following : u.is_following;
          const serverFollowing = u.is_following;

          const serverFollowersCount = u.follower_count ?? u.followers_count ?? 0;
          const localFollowersCount = prev.follower_count ?? prev.followers_count ?? serverFollowersCount;

          // If refresh returns a different follow-state than local optimistic state,
          // keep local count to avoid counting follow/unfollow twice.
          const effectiveFollowersCount =
            typeof localFollowing === 'boolean' &&
            typeof serverFollowing === 'boolean' &&
            localFollowing !== serverFollowing
              ? localFollowersCount
              : serverFollowersCount;

          return {
            ...u,
            is_following: localFollowing,
            follower_count: effectiveFollowersCount,
            followers_count: effectiveFollowersCount,
          };
        });
      });
      setPosts(postsItems);
      setHashtags(buildHashtagResults(query, postsItems, hashtagsSuggestionTexts));
    } catch (err) {
      setError(err as Error);
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, [buildHashtagResults]);

  const setUserFollowState = useCallback((userId: string, isFollowing: boolean) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) => {
        if (user.id !== userId) return user;

        const followersCount = user.follower_count ?? user.followers_count ?? 0;
        const nextCount = isFollowing
          ? followersCount + (user.is_following ? 0 : 1)
          : Math.max(0, followersCount - (user.is_following ? 1 : 0));

        return {
          ...user,
          is_following: isFollowing,
          follower_count: nextCount,
          followers_count: nextCount,
        };
      })
    );
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
    setUserFollowState,
    clear,
  };
};
