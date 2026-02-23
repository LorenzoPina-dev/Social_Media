import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Profile } from '@/types/user.types';
import { getUserProfile, updateProfile, followUser, unfollowUser } from '@/api/users';
import { getUserPosts } from '@/api/posts';
import { Post } from '@/types/post.types';
import { useAuth } from './useAuth';
import toast from 'react-hot-toast';

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
      setProfile(response.data);
    } catch (err) {
      setError(err as Error);
      if (err instanceof Error && err.message.includes('404')) {
        navigate('/404');
      }
    } finally {
      setIsLoading(false);
    }
  }, [username, navigate]);

  const fetchPosts = useCallback(async (reset = false) => {
    if (!profile?.id) return;
    
    setIsLoadingPosts(true);
    
    try {
      const response = await getUserPosts(profile.id, {
        cursor: reset ? undefined : postsCursor || undefined,
        limit: 12,
      });
      
      const newPosts = response.data.data;
      const newCursor = response.data.cursor;
      
      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      setPostsCursor(newCursor || null);
      setHasMorePosts(!!newCursor);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setIsLoadingPosts(false);
    }
  }, [profile?.id, postsCursor]);

  useEffect(() => {
    if (username) {
      fetchProfile();
    }
  }, [username, fetchProfile]);

  useEffect(() => {
    if (profile?.id) {
      fetchPosts(true);
    }
  }, [profile?.id]);

  const updateUserProfile = useCallback(async (data: any) => {
    if (!isOwnProfile) return;
    
    try {
      const response = await updateProfile(data);
      setProfile(response.data);
      if (user) {
        updateUser({ display_name: response.data.display_name, avatar_url: response.data.avatar_url });
      }
      toast.success('Profilo aggiornato!');
      return response.data;
    } catch (err) {
      toast.error('Errore durante l\'aggiornamento');
      throw err;
    }
  }, [isOwnProfile, user, updateUser]);

  const follow = useCallback(async () => {
    if (!profile) return;
    
    try {
      await followUser(profile.id);
      setProfile({
        ...profile,
        is_following: true,
        follower_count: profile.follower_count + 1,
      });
      toast.success(`Ora segui ${profile.username}`);
    } catch (err) {
      toast.error('Errore durante il follow');
      throw err;
    }
  }, [profile]);

  const unfollow = useCallback(async () => {
    if (!profile) return;
    
    try {
      await unfollowUser(profile.id);
      setProfile({
        ...profile,
        is_following: false,
        follower_count: Math.max(0, profile.follower_count - 1),
      });
      toast.success(`Non segui più ${profile.username}`);
    } catch (err) {
      toast.error('Errore durante l\'unfollow');
      throw err;
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