import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Post } from '@/types/post.types';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { PostActions } from '@/components/post/PostActions';
import { MediaGallery } from './MediaGallery';
import { PostMenu } from './PostMenu';
import { CommentSection } from '@/components/interactions/CommentSection';
import { useAuth } from '@/hooks/useAuth';
import styles from './PostCard.module.css';

interface PostCardProps {
  post: Post & { user: { username: string, avatar_url?: string, verified?: boolean }, is_liked: boolean, is_saved: boolean };
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onLike,
  onComment,
  onShare,
  onSave,
  onDelete,
  onEdit,
}) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const isOwner = user?.id === post.user_id;

  const handleCommentClick = () => {
    setShowComments(!showComments);
    onComment?.();
  };

  const handleLikeUpdate = (liked: boolean, count: number) => {
    post.is_liked = liked;
    post.like_count = count;
  };

  const handleSaveUpdate = (saved: boolean) => {
    post.is_saved = saved;
  };

  return (
    <article className={styles.postCard}>
      <header className={styles.header}>
        <div className={styles.userInfo}>
          <Link to={`/profile/${post.user.username}`} className={styles.avatarLink}>
            <Avatar
              src={post.user.avatar_url}
              username={post.user.username}
              size="small"
            />
          </Link>
          <div className={styles.userDetails}>
            <Link to={`/profile/${post.user.username}`} className={styles.username}>
              {post.user.username}
              {post.user.verified && (
                <span className={styles.verifiedBadge}>✓</span>
              )}
            </Link>
            <span className={styles.timestamp}>
              {formatDistanceToNow(new Date(post.created_at), {
                addSuffix: true,
                locale: it,
              })}
            </span>
          </div>
        </div>
        
        {isOwner && (
          <PostMenu
            postId={post.id}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        )}
      </header>

      {post.media_urls && post.media_urls.length > 0 && (
        <MediaGallery
          mediaUrls={post.media_urls}
          mediaTypes={post.media_types as string[]}
          className={styles.media}
        />
      )}

      <div className={styles.content}>
        <p>{post.content}</p>
        
        {post.hashtags && post.hashtags.length > 0 && (
          <div className={styles.hashtags}>
            {post.hashtags.map(tag => (
              <Link key={tag} to={`/explore?tag=${tag}`} className={styles.hashtag}>
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className={styles.stats}>
        <span className={styles.likeCount}>
          {post.like_count.toLocaleString('it-IT')} mi piace
        </span>
        <button
          className={styles.commentCount}
          onClick={() => setShowComments(true)}
        >
          {post.comment_count.toLocaleString('it-IT')} commenti
        </button>
      </div>

      <PostActions
        postId={post.id}
        initialLiked={post.is_liked}
        initialSaved={post.is_saved}
        likeCount={post.like_count}
        onLikeUpdate={handleLikeUpdate}
        onSaveUpdate={handleSaveUpdate}
        onCommentClick={handleCommentClick}
        onShareClick={onShare}
      />

      {showComments && (
        <div className={styles.comments}>
          <CommentSection
            postId={post.id}
            onClose={() => setShowComments(false)}
          />
        </div>
      )}
    </article>
  );
};