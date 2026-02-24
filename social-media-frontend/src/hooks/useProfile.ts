import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Profile } from '@/types/user.types';
import { getUserProfile, updateProfile, followUser, unfollowUser } from '@/api/users';
import { getUserPosts } from '@/api/posts';
import { Post } from '@/types/post.types';
import { useAuth } from './useAuth';
import toast from 'react-hot-toast';
import { unwrapCursorPage, unwrapData } from '@/api/envelope';

export const useProfile = (username?: string) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);

  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const isOwnProfile = user?.username === username;

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getUserProfile(username);
      setProfile(unwrapData<Profile>(response.data));
    } catch (err) {
      setError(err as Error);
      if (err instanceof Error && err.message.includes('404')) {
        navigate('/404');
      }
    } finally {
      setIsLoading(false);
    }
  }, [username, navigate]);

  const fetchPosts = useCallback(
    async (reset = false) => {
      if (!profile?.id) return;

      setIsLoadingPosts(true);

      try {
        const response = await getUserPosts(profile.id, {
          cursor: reset ? undefined : postsCursor || undefined,
          limit: 12,
        });
        const page = unwrapCursorPage<Post>(response.data);
        const newPosts = page.items;
        const newCursor = page.cursor;

        setPosts((prev) => (reset ? newPosts : [...prev, ...newPosts]));
        setPostsCursor(newCursor || null);
        setHasMorePosts(page.has_more);
      } catch (err) {
        console.error('Failed to load posts:', err);
      } finally {
        setIsLoadingPosts(false);
      }
    },
    [profile?.id, postsCursor]
  );

  useEffect(() => {
    if (username) {
      fetchProfile();
    }
  }, [username, fetchProfile]);

  useEffect(() => {
    if (profile?.id) {
      fetchPosts(true);
    }
  }, [profile?.id, fetchPosts]);

  const updateUserProfile = useCallback(
    async (data: any) => {
      if (!isOwnProfile) return;

      try {
        const response = await updateProfile(data);
        const nextProfile = unwrapData<Profile>(response.data);
        setProfile(nextProfile);
        if (user) {
          updateUser({
            display_name: nextProfile.display_name,
            avatar_url: nextProfile.avatar_url,
          });
        }
        toast.success('Profilo aggiornato!');
      } catch (err) {
        toast.error("Errore durante l'aggiornamento");
        throw err;
      }
    },
    [isOwnProfile, user, updateUser]
  );

  const follow = useCallback(async () => {
    if (!profile) return;

    try {
      await followUser(profile.id);
      const followersCount =
        (profile as any).followers_count ?? (profile as any).follower_count ?? 0;
      setProfile({
        ...profile,
        is_following: true,
        follower_count: followersCount + 1,
        followers_count: followersCount + 1,
      });
      toast.success(`Ora segui ${profile.username}`);
    } catch (err) {
      // handled by button/toast at call site
    }
  }, [profile]);

  const unfollow = useCallback(async () => {
    if (!profile) return;

    try {
      await unfollowUser(profile.id);
      const followersCount =
        (profile as any).followers_count ?? (profile as any).follower_count ?? 0;
      const nextCount = Math.max(0, followersCount - 1);
      setProfile({
        ...profile,
        is_following: false,
        follower_count: nextCount,
        followers_count: nextCount,
      });
      toast.success(`Non segui più ${profile.username}`);
    } catch (err) {
      // handled by button/toast at call site
    }
  }, [profile]);

  return {
    profile,
    posts,
    isLoading,
    isLoadingPosts,
    error,
    hasMorePosts,
    isOwnProfile,
    fetchProfile,
    fetchPosts,
    updateProfile: updateUserProfile,
    follow,
    unfollow,
  };
};
