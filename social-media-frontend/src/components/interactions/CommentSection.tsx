import { useState, useRef, useEffect } from 'react';
import { useComments } from '@/hooks/useComments';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { Button } from '@/components/common/Buttons/Button';
import { Spinner } from '@/components/common/Loading/Spinner';
import styles from './CommentSection.module.css';

interface CommentSectionProps {
  postId: string;
  onClose?: () => void;
  onCommentAdded?: () => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  onClose,
  onCommentAdded,
}) => {
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const {
    comments,
    isLoading,
    isSending,
    hasMore,
    fetchComments,
    addComment,
    deleteComment,
    toggleLike,
    loadReplies,
  } = useComments(postId);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchComments(true);
  }, []);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleAddComment = async (content: string) => {
    await addComment(content, replyTo?.id);
    setReplyTo(null);
    scrollToBottom();
    onCommentAdded?.();
  };

  const handleReply = (commentId: string, username: string) => {
    setReplyTo({ id: commentId, username });
  };

  const handleCancelReply = () => {
    setReplyTo(null);
  };

  return (
    <div className={styles.commentSection} ref={containerRef}>
      <div className={styles.header}>
        <h3 className={styles.title}>Commenti</h3>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose}>
            <svg viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        )}
      </div>

      <div className={styles.commentsList}>
        {isLoading && comments.length === 0 ? (
          <div className={styles.loading}>
            <Spinner size="medium" />
          </div>
        ) : (
          <>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={handleReply}
                onDelete={deleteComment}
                onLike={toggleLike}
                onLoadReplies={loadReplies}
              />
            ))}

            {hasMore && (
              <div className={styles.loadMore}>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => fetchComments()}
                  loading={isLoading}
                >
                  Carica altri commenti
                </Button>
              </div>
            )}

            <div ref={commentsEndRef} />
          </>
        )}
      </div>

      <div className={styles.commentForm}>
        {replyTo && (
          <div className={styles.replyingTo}>
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
        )}
        
        <CommentForm
          onSubmit={handleAddComment}
          isLoading={isSending}
          placeholder={replyTo ? `Rispondi a @${replyTo.username}...` : 'Aggiungi un commento...'}
        />
      </div>
    </div>
  );
};