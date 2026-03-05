import { useFeed } from '@/hooks/useFeed';
import { useAuth } from '@/hooks/useAuth';
import { useModal } from '@/contexts/ModalContext';
import { CreatePostModal } from '@/components/post/CreatePost/CreatePostModal';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { FeedPost } from './FeedPost';
import { FeedSkeleton } from './FeedSkeleton';
import { EmptyFeed } from './EmptyFeed';
import styles from './Feed.module.css';

export const Feed = () => {
  const { user } = useAuth();
  const { openModal } = useModal();

  const {
    posts,
    isLoading,
    error,
    hasMore,
    lastElementRef,
    refresh,
    removePost,
    newPostsBanner,
    dismissBanner,
  } = useFeed();

  const handleOpenComposer = () => {
    openModal(
      'create-post',
      <CreatePostModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {
          window.dispatchEvent(new CustomEvent('feed:refresh'));
        }}
      />
    );
  };

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

  return (
    <div className={styles.feed}>
      {/* ── Banner nuovi post real-time ── */}
      {newPostsBanner > 0 && (
        <div className={styles.newPostsBanner}>
          <button className={styles.newPostsBannerBtn} onClick={dismissBanner}>
            ↑ {newPostsBanner === 1 ? '1 nuovo post' : `${newPostsBanner} nuovi post`}
          </button>
        </div>
      )}

      {/* ── Composer inline ── */}
      <div className={styles.composer} onClick={handleOpenComposer}>
        <Avatar
          src={user?.avatar_url}
          username={user?.username}
          size="small"
          className={styles.composerAvatar}
        />
        <div className={styles.composerInput}>
          <span className={styles.composerPlaceholder}>
            Cosa stai pensando, {user?.display_name || user?.username}?
          </span>
        </div>
        <button className={styles.composerBtn} type="button">
          Pubblica
        </button>
      </div>

      {/* ── Skeleton iniziale ── */}
      {isLoading && posts.length === 0 && <FeedSkeleton count={3} />}

      {/* ── Empty state ── */}
      {!isLoading && posts.length === 0 && <EmptyFeed />}

      {/* ── Post list ── */}
      {posts.map((item, index) => (
        <FeedPost
          key={item.postId}
          item={item}
          ref={index === posts.length - 1 ? lastElementRef : null}
          onDelete={() => removePost(item.postId)}
        />
      ))}

      {/* ── Caricamento pagina successiva ── */}
      {isLoading && posts.length > 0 && <FeedSkeleton count={2} />}

      {!hasMore && posts.length > 0 && (
        <div className={styles.endMessage}>
          Hai visto tutti i post — sei aggiornato! 🎉
        </div>
      )}
    </div>
  );
};
