import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Post } from '@/types/post.types';
import { Avatar } from '@/components/common/Avatar/Avatar';
import styles from './PostResult.module.css';

interface PostResultProps {
  post: Post;
  onClick?: () => void;
}

export const PostResult: React.FC<PostResultProps> = ({ post, onClick }) => {
  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <Link to={`/p/${post.id}`} className={styles.postResult} onClick={onClick}>
      {post.media_urls && post.media_urls.length > 0 && (
        <div className={styles.thumbnail}>
          <img
            src={post.media_urls[0]}
            alt=""
            className={styles.image}
          />
          {post.media_types[0] === 'video' && (
            <span className={styles.videoIcon}>▶</span>
          )}
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.user}>
          <Avatar
            src={post.user.avatar_url}
            username={post.user.username}
            size="small"
          />
          <span className={styles.username}>
            {post.user.username}
            {post.user.verified && (
              <span className={styles.verifiedBadge}>✓</span>
            )}
          </span>
          <span className={styles.timestamp}>
            {formatDistanceToNow(new Date(post.created_at), {
              addSuffix: true,
              locale: it,
            })}
          </span>
        </div>

        <p className={styles.text}>{truncateContent(post.content)}</p>

        <div className={styles.stats}>
          <span>❤️ {post.like_count}</span>
          <span>💬 {post.comment_count}</span>
          <span>🔄 {post.share_count}</span>
        </div>
      </div>
    </Link>
  );
};