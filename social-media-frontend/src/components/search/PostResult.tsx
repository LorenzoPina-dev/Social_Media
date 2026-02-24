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

  const username = post.user?.username || post.user_id || 'utente';
  const avatarUrl = post.user?.avatar_url;
  const isVerified = Boolean(post.user?.verified);
  const likeCount = post.like_count ?? post.likes_count ?? 0;
  const commentCount = post.comment_count ?? post.comments_count ?? 0;
  const shareCount = post.share_count ?? post.shares_count ?? 0;

  return (
    <Link to={`/p/${post.id}`} className={styles.postResult} onClick={onClick}>
      {Array.isArray(post.media_urls) && post.media_urls.length > 0 && (
        <div className={styles.thumbnail}>
          <img src={post.media_urls[0]} alt="" className={styles.image} />
          {Array.isArray(post.media_types) && post.media_types[0] === 'video' && (
            <span className={styles.videoIcon}>Play</span>
          )}
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.user}>
          <Avatar src={avatarUrl} username={username} size="small" />
          <span className={styles.username}>
            {username}
            {isVerified && <span className={styles.verifiedBadge}>OK</span>}
          </span>
          <span className={styles.timestamp}>
            {formatDistanceToNow(new Date(post.created_at), {
              addSuffix: true,
              locale: it,
            })}
          </span>
        </div>

        <p className={styles.text}>{truncateContent(post.content || '')}</p>

        <div className={styles.stats}>
          <span>Like {likeCount}</span>
          <span>Comment {commentCount}</span>
          <span>Share {shareCount}</span>
        </div>
      </div>
    </Link>
  );
};
