import { useState } from 'react';
import { LikeButton } from '@/components/interactions/LikeButton';
import { CommentButton } from '@/components/interactions/CommentButton';
import { ShareButton } from '@/components/interactions/ShareButton';
import { SaveButton } from '@/components/interactions/SaveButton';
import styles from './PostActions.module.css';

interface PostActionsProps {
  postId: string;
  initialLiked?: boolean;
  initialSaved?: boolean;
  likeCount: number;
  onLikeUpdate?: (liked: boolean, count: number) => void;
  onSaveUpdate?: (saved: boolean) => void;
  onCommentClick?: () => void;
  onShareClick?: () => void;
}

export const PostActions: React.FC<PostActionsProps> = ({
  postId,
  initialLiked = false,
  initialSaved = false,
  likeCount,
  onLikeUpdate,
  onSaveUpdate,
  onCommentClick,
  onShareClick,
}) => {
  const [liked, setLiked] = useState(initialLiked);
  const [saved, setSaved] = useState(initialSaved);
  const [currentLikeCount, setCurrentLikeCount] = useState(likeCount);

  const handleLike = (newLiked: boolean) => {
    setLiked(newLiked);
    const newCount = newLiked ? currentLikeCount + 1 : currentLikeCount - 1;
    setCurrentLikeCount(newCount);
    onLikeUpdate?.(newLiked, newCount);
  };

  const handleSave = (newSaved: boolean) => {
    setSaved(newSaved);
    onSaveUpdate?.(newSaved);
  };

  return (
    <div className={styles.actions}>
      <div className={styles.leftActions}>
        <LikeButton
          postId={postId}
          initialLiked={liked}
          onLike={handleLike}
        />
        <CommentButton onClick={onCommentClick} />
        <ShareButton postId={postId} onShare={onShareClick} />
      </div>
      
      <SaveButton
        postId={postId}
        initialSaved={saved}
        onSave={handleSave}
      />
    </div>
  );
};