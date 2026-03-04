import { IconButton } from '@/components/common/Buttons/IconButton';
import styles from './CommentButton.module.css';

interface CommentButtonProps {
  onClick?: () => void;
  count?: number;
  active?: boolean;
}

export const CommentButton: React.FC<CommentButtonProps> = ({
  onClick,
  count,
  active = false,
}) => {
  return (
    <div className={styles.container}>
      <IconButton
        onClick={onClick}
        label="Commenta"
        className={`${styles.commentButton} ${active ? styles.active : ''}`}
      >
            <svg
                viewBox="0 0 24 24"
                className={styles.actionIcon}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
      </IconButton>
      {count !== undefined && count > 0 && (
        <span className={styles.count}>{count}</span>
      )}
    </div>
  );
};