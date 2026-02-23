import { useState } from 'react';
import { Button } from '@/components/common/Buttons/Button';
import { followUser, unfollowUser } from '@/api/users';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import styles from './FollowButton.module.css';

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
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, user } = useAuth();

  const isOwnProfile = user?.id === userId;

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
      loading={isLoading}
      className={styles.followButton}
    >
      {following ? 'Seguito' : 'Segui'}
    </Button>
  );
};