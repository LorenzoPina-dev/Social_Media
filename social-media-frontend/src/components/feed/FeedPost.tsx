import { forwardRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { FeedPost as FeedPostType } from '@/types/feed.types';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { PostActions } from '@/components/post/PostActions';
import { MediaGallery } from '@/components/post/MediaGallery';
import { PostMenu } from '@/components/post/PostMenu';
import { useAuth } from '@/hooks/useAuth';
import styles from './FeedPost.module.css';

interface FeedPostProps {
  post: FeedPostType;
  onUpdate?: (updates: Partial<FeedPostType>) => void;
  onDelete?: () => void;
}

export const FeedPost = forwardRef<HTMLDivElement, FeedPostProps>(
  ({ post, onUpdate, onDelete }, ref) => {
    const { user } = useAuth();
    const isOwner = user?.id === post.user_id;

    const handleLikeUpdate = (liked: boolean, count: number) => {
      onUpdate?.({ is_liked: liked, like_count: count });
    };

    const handleSaveUpdate = (saved: boolean) => {
      onUpdate?.({ is_saved: saved });
    };
    
      const mediaUrls = useMemo(() => {
        if (!post.media_urls) return [];
        return typeof post.media_urls === 'string' ? JSON.parse(post.media_urls) : post.media_urls;
      }, [post.media_urls]);
    
      const mediaTypes = useMemo(() => {
        if (!post.media_types) return [];
        return typeof post.media_types === 'string' ? JSON.parse(post.media_types) : post.media_types;
      }, [post.media_types]);

    return (
      <article className={styles.post} ref={ref}>
        <header className={styles.header}>
          <div className={styles.userInfo}>
            <Link to={`/profile/${post.user.id}`}>
              <Avatar
                src={post.user.avatar_url}
                username={post.user.username}
                size="small"
              />
            </Link>
            <div className={styles.userDetails}>
              <Link
                to={`/profile/${post.user.username}`}
                className={styles.username}
              >
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
              onEdit={() => {}}
            />
          )}
        </header>

        {post.media_urls && post.media_urls.length > 0 && (
          <MediaGallery
            mediaUrls={mediaUrls}
            mediaTypes={mediaTypes}
            className={styles.media}
          />
        )}

        <div className={styles.content}>
          <p>{post.content}</p>
          
          {post.hashtags && post.hashtags.length > 0 && (
            <div className={styles.hashtags}>
              {post.hashtags.map(tag => (
                <Link
                  key={tag}
                  to={`/explore?tag=${tag}`}
                  className={styles.hashtag}
                >
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
          <Link
            to={`/p/${post.id}`}
            className={styles.commentCount}
          >
            {post.comment_count.toLocaleString('it-IT')} commenti
          </Link>
        </div>

        <PostActions
          postId={post.id}
          initialLiked={post.is_liked}
          initialSaved={post.is_saved}
          likeCount={post.like_count}
          onLikeUpdate={handleLikeUpdate}
          onSaveUpdate={handleSaveUpdate}
        />
      </article>
    );
  }
);

FeedPost.displayName = 'FeedPost';