import { useEffect, useState } from 'react';
import { Button } from '@/components/common/Buttons/Button';
import { checkFollow, followUser, unfollowUser } from '@/api/users';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import styles from './FollowButton.module.css';
import { unwrapData } from '@/api/envelope';

interface FollowButtonProps {
  userId: string;
  initialFollowing?: boolean;
  onFollow?: () => void;
  onUnfollow?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  userId,
  initialFollowing = false,
  onFollow,
  onUnfollow,
  size = 'medium',
}) => {
  const [following, setFollowing] = useState(initialFollowing);
  const [hasResolvedStatus, setHasResolvedStatus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, user } = useAuth();

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  useEffect(() => {
    const resolveFollowStatus = async () => {
      if (!isAuthenticated || !user?.id || isOwnProfile) {
        setHasResolvedStatus(true);
        return;
      }

      try {
        const response = await checkFollow(user.id, userId);
        const data = unwrapData<{ isFollowing?: boolean }>(response.data);
        if (typeof data?.isFollowing === 'boolean') {
          setFollowing(data.isFollowing);
        }
      } catch {
        // Keep optimistic/UI-provided state if status check fails
      } finally {
        setHasResolvedStatus(true);
      }
    };

    resolveFollowStatus();
  }, [isAuthenticated, isOwnProfile, user?.id, userId]);

  if (isOwnProfile) {
    return null;
  }

  const handleClick = async () => {
    if (!isAuthenticated) {
      toast.error('Devi essere loggato per seguire utenti');
      return;
    }

    setIsLoading(true);
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
        onUnfollow?.();
        toast.success('Non segui più questo utente');
      } else {
        await followUser(userId);
        setFollowing(true);
        onFollow?.();
        toast.success('Ora segui questo utente');
      }
    } catch (error) {
      toast.error('Errore durante l\'operazione');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={following ? 'outline' : 'primary'}
      size={size}
      onClick={handleClick}
      loading={isLoading || (!hasResolvedStatus && isAuthenticated)}
      className={styles.followButton}
    >
      {following ? 'Unfollow' : 'Segui'}
    </Button>
  );
};
