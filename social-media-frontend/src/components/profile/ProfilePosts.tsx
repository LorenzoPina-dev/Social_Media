import { Link } from 'react-router-dom';
import { Post } from '@/types/post.types';
import styles from './ProfilePosts.module.css';

interface ProfilePostsProps {
  posts: Post[];
}

export const ProfilePosts: React.FC<ProfilePostsProps> = ({ posts }) => {
  if (posts.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📷</div>
        <h3 className={styles.emptyTitle}>Nessun post</h3>
        <p className={styles.emptyText}>
          Quando pubblichi qualcosa, apparirà qui.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {posts.map((post) => (
        <Link key={post.id} to={`/p/${post.id}`} className={styles.post}>
          {post.media_urls && post.media_urls.length > 0 && (
            <div className={styles.media}>
              <img
                src={post.media_urls[0]}
                alt=""
                className={styles.image}
                loading="lazy"
              />
              {post.media_urls.length > 1 && (
                <span className={styles.multipleIcon}>📁</span>
              )}
              {post.media_types[0] === 'video' && (
                <span className={styles.videoIcon}>▶</span>
              )}
            </div>
          )}
          <div className={styles.overlay}>
            <div className={styles.stats}>
              <span>❤️ {post.like_count}</span>
              <span>💬 {post.comment_count}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};