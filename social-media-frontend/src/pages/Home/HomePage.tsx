import { Feed } from '@/components/feed/Feed';
import { Stories } from '@/components/feed/Stories';
import { Suggestions } from '@/components/feed/Suggestions';
import { TrendingHashtags } from '@/components/feed/TrendingHashtags';
import { CreatePostModal } from '@/components/post/CreatePost/CreatePostModal';
import { useModal } from '@/contexts/ModalContext';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/useMediaQuery';
import styles from './HomePage.module.css';

const HomePage = () => {
  const { isAuthenticated, user } = useAuth();
  const { openModal } = useModal();
  const isMobile = useIsMobile();

  const handleCreatePost = () => {
    openModal('create-post', <CreatePostModal isOpen={true} onClose={() => {}} />);
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.landing}>
        <div className={styles.landingContent}>
          <h1 className={styles.landingTitle}>Benvenuto su SocialApp</h1>
          <p className={styles.landingSubtitle}>
            Connettiti con amici e condividi i tuoi momenti
          </p>
          <div className={styles.landingButtons}>
            <a href="/login" className={styles.loginButton}>
              Accedi
            </a>
            <a href="/register" className={styles.registerButton}>
              Registrati
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.homePage}>
      <div className={styles.mainContent}>
        <Stories />
        <Feed />
      </div>
      
      {!isMobile && (
        <aside className={styles.sidebar}>
          <div className={styles.userInfo}>
            <img
              src={user?.avatar_url || '/default-avatar.png'}
              alt={user?.username}
              className={styles.userAvatar}
            />
            <div className={styles.userDetails}>
              <span className={styles.username}>{user?.username}</span>
              <span className={styles.displayName}>{user?.display_name}</span>
            </div>
          </div>
          
          <Suggestions />
          <TrendingHashtags />
        </aside>
      )}

      <button
        className={styles.createPostFab}
        onClick={handleCreatePost}
        aria-label="Crea post"
      >
        <svg viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>
    </div>
  );
};

export default HomePage