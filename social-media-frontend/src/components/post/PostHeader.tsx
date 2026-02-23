import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { PostMenu } from './PostMenu';
import styles from './PostHeader.module.css';

interface PostHeaderProps {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
  verified?: boolean;
  createdAt: string;
  isOwner?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
}

export const PostHeader: React.FC<PostHeaderProps> = ({
  userId,
  username,
  displayName,
  avatarUrl,
  verified = false,
  createdAt,
  isOwner = false,
  onDelete,
  onEdit,
}) => {
  return (
    <div className={styles.header}>
      <div className={styles.userInfo}>
        <Link to={`/profile/${username}`} className={styles.avatarLink}>
          <Avatar
            src={avatarUrl}
            username={username}
            size="small"
          />
        </Link>
        <div className={styles.userDetails}>
          <div className={styles.nameRow}>
            <Link to={`/profile/${username}`} className={styles.username}>
              {username}
            </Link>
            {verified && (
              <span className={styles.verifiedBadge}>✓</span>
            )}
          </div>
          <span className={styles.timestamp}>
            {formatDistanceToNow(new Date(createdAt), {
              addSuffix: true,
              locale: it,
            })}
          </span>
        </div>
      </div>
      
      {isOwner && (
        <PostMenu
          postId={userId}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      )}
    </div>
  );
};