import { useFeed } from '@/hooks/useFeed';
import { FeedPost } from './FeedPost';
import { FeedSkeleton } from './FeedSkeleton';
import { EmptyFeed } from './EmptyFeed';
import styles from './Feed.module.css';

export const Feed = () => {
  const {
    posts,
    isLoading,
    error,
    hasMore,
    lastElementRef,
    refresh,
    updatePost,
    removePost,
  } = useFeed();

  if (error) {
    return (
      <div className={styles.error}>
        <p>Errore nel caricamento del feed</p>
        <button onClick={refresh} className={styles.retryButton}>
          Riprova
        </button>
      </div>
    );
  }

  if (!isLoading && posts.length === 0) {
    return <EmptyFeed />;
  }

  return (
    <div className={styles.feed}>
      {posts.map((post, index) => (
        <FeedPost
          key={post.id}
          post={post}
          ref={index === posts.length - 1 ? lastElementRef : null}
          onUpdate={(updates) => updatePost(post.id, updates)}
          onDelete={() => removePost(post.id)}
        />
      ))}
      
      {isLoading && <FeedSkeleton count={2} />}
      
      {!hasMore && posts.length > 0 && (
        <div className={styles.endMessage}>
          Non ci sono altri post da mostrare
        </div>
      )}
    </div>
  );
};
