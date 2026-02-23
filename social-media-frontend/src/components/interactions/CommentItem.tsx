import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Comment } from '@/types/interaction.types';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { IconButton } from '@/components/common/Buttons/IconButton';
import { ConfirmDialog } from '@/components/common/Modals/ConfirmDialog';
import { useAuth } from '@/hooks/useAuth';
import styles from './CommentItem.module.css';

interface CommentItemProps {
  comment: Comment;
  onReply?: (commentId: string, username: string) => void;
  onDelete?: (commentId: string) => Promise<void>;
  onLike?: (commentId: string) => Promise<void>;
  onLoadReplies?: (commentId: string) => Promise<void>;
  depth?: number;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onReply,
  onDelete,
  onLike,
  onLoadReplies,
  depth = 0,
}) => {
  const [showReplies, setShowReplies] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const { user } = useAuth();
  const isOwner = user?.id === comment.user_id;

  const handleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    try {
      await onLike?.(comment.id);
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete?.(comment.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleLoadReplies = async () => {
    if (!showReplies && comment.reply_count && comment.reply_count > 0) {
      await onLoadReplies?.(comment.id);
    }
    setShowReplies(!showReplies);
  };

  const maxDepth = 3;
  const canReply = depth < maxDepth;

  return (
    <div className={styles.commentItem} style={{ marginLeft: depth * 20 }}>
      <div className={styles.commentContent}>
        <Link to={`/profile/${comment.user.username}`} className={styles.avatar}>
          <Avatar
            src={comment.user.avatar_url}
            username={comment.user.username}
            size="small"
          />
        </Link>

        <div className={styles.contentWrapper}>
          <div className={styles.header}>
            <Link to={`/profile/${comment.user.username}`} className={styles.username}>
              {comment.user.username}
              {comment.user.verified && (
                <span className={styles.verifiedBadge}>✓</span>
              )}
            </Link>
            <span className={styles.timestamp}>
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
                locale: it,
              })}
            </span>
          </div>

          <p className={styles.text}>{comment.content}</p>

          <div className={styles.actions}>
            <button
              className={`${styles.likeButton} ${comment.is_liked ? styles.liked : ''}`}
              onClick={handleLike}
              disabled={isLiking}
            >
              {comment.is_liked ? 'Mi piace' : 'Mi piace'}
              {comment.like_count > 0 && (
                <span className={styles.likeCount}>{comment.like_count}</span>
              )}
            </button>

            {canReply && (
              <button
                className={styles.replyButton}
                onClick={() => onReply?.(comment.id, comment.user.username)}
              >
                Rispondi
              </button>
            )}

            {isOwner && (
              <button
                className={styles.deleteButton}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Elimina
              </button>
            )}
          </div>
        </div>
      </div>

      {comment.reply_count && comment.reply_count > 0 && (
        <div className={styles.repliesToggle}>
          <button onClick={handleLoadReplies}>
            {showReplies ? (
              <>Nascondi risposte</>
            ) : (
              <>Mostra {comment.reply_count} risposte</>
            )}
          </button>
        </div>
      )}

      {showReplies && comment.replies && (
        <div className={styles.replies}>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onDelete={onDelete}
              onLike={onLike}
              onLoadReplies={onLoadReplies}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Elimina commento"
        message="Sei sicuro di voler eliminare questo commento?"
        confirmText={isDeleting ? 'Eliminazione...' : 'Elimina'}
        variant="danger"
      />
    </div>
  );
};