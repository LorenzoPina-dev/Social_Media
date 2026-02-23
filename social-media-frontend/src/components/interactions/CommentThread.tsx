import { useState } from 'react';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { Comment } from '@/types/interaction.types';
import styles from './CommentThread.module.css';

interface CommentThreadProps {
  comments: Comment[];
  onAddComment: (content: string, parentId?: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onLikeComment: (commentId: string) => Promise<void>;
  onLoadReplies: (commentId: string) => Promise<void>;
  isLoading?: boolean;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  comments,
  onAddComment,
  onDeleteComment,
  onLikeComment,
  onLoadReplies,
  isLoading,
}) => {
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);

  const handleReply = (commentId: string, username: string) => {
    setReplyTo({ id: commentId, username });
  };

  const handleCancelReply = () => {
    setReplyTo(null);
  };

  const handleSubmitReply = async (content: string) => {
    if (replyTo) {
      await onAddComment(content, replyTo.id);
      setReplyTo(null);
    }
  };

  return (
    <div className={styles.thread}>
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onReply={handleReply}
          onDelete={onDeleteComment}
          onLike={onLikeComment}
          onLoadReplies={onLoadReplies}
        />
      ))}

      {replyTo && (
        <div className={styles.replyForm}>
          <div className={styles.replyHeader}>
            <span>Rispondendo a @{replyTo.username}</span>
            <button
              className={styles.cancelReply}
              onClick={handleCancelReply}
            >
              <svg viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <CommentForm
            onSubmit={handleSubmitReply}
            isLoading={isLoading}
            placeholder="Scrivi una risposta..."
            autoFocus
          />
        </div>
      )}
    </div>
  );
};