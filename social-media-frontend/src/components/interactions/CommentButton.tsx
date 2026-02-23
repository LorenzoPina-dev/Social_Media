import { IconButton } from '@/components/common/Buttons/IconButton';
import styles from './CommentButton.module.css';

interface CommentButtonProps {
  onClick?: () => void;
  count?: number;
}

export const CommentButton: React.FC<CommentButtonProps> = ({
  onClick,
  count,
}) => {
  return (
    <div className={styles.container}>
      <IconButton
        onClick={onClick}
        label="Commenta"
        className={styles.commentButton}
      >
        <svg viewBox="0 0 24 24">
          <path d="M21 6h-2v2h-2V6h-2V4h2V2h2v2h2v2zm-6-4v2h-2V2h2zm0 8h-2v2h2v-2zm-2-4h2v2h-2V6zm4 4h-2v2h2v-2zm-8-4h2v2h-2V6zm8 10c0 1.1-.9 2-2 2h-1c0 1.66-1.34 3-3 3s-3-1.34-3-3H7c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h5v2H7v10h10v-3h2v3z"/>
        </svg>
      </IconButton>
      {count !== undefined && count > 0 && (
        <span className={styles.count}>{count}</span>
      )}
    </div>
  );
};