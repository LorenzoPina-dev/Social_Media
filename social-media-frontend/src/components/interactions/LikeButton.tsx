import { useState } from 'react';
import { IconButton } from '@/components/common/Buttons/IconButton';
import { likePost, unlikePost } from '@/api/interactions';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import styles from './LikeButton.module.css';

interface LikeButtonProps {
  postId: string;
  initialLiked?: boolean;
  onLike?: (liked: boolean) => void;
}

export const LikeButton: React.FC<LikeButtonProps> = ({
  postId,
  initialLiked = false,
  onLike,
}) => {
  const [liked, setLiked] = useState(initialLiked);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  const handleClick = async () => {
    if (!isAuthenticated) {
      toast.error('Devi essere loggato per mettere like');
      return;
    }

    setIsLoading(true);
    try {
      if (liked) {
        await unlikePost(postId);
      } else {
        await likePost(postId);
      }
      setLiked(!liked);
      onLike?.(!liked);
    } catch (error) {
      toast.error('Errore durante l\'operazione');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <IconButton
      onClick={handleClick}
      disabled={isLoading}
      label={liked ? 'Rimuovi like' : 'Metti like'}
      className={`${styles.likeButton} ${liked ? styles.liked : ''}`}
    >
      <svg
                viewBox="0 0 24 24"
                className={styles.actionIcon}
                fill={liked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
    </IconButton>
  );
};