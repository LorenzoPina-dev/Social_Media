import { Feed } from '@/components/feed/Feed';
import { Stories } from '@/components/feed/Stories';
import { Suggestions } from '@/components/feed/Suggestions';
import { TrendingHashtags } from '@/components/feed/TrendingHashtags';
import { CreatePostModal } from '@/components/post/CreatePost/CreatePostModal';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { useModal } from '@/contexts/ModalContext';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Link } from 'react-router-dom';
import styles from './HomePage.module.css';

const HomePage = () => {
  const { user } = useAuth();
  const { openModal } = useModal();
  const isMobile = useIsMobile();

  const handleCreatePost = () => {
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

  /*if (!isAuthenticated) {
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
  }*/

  return (
    <div className={styles.homePage}>
      <div className={styles.mainContent}>
        <Stories />
        <Feed />
      </div>
      
      {!isMobile && (
        <aside className={styles.sidebar}>
          <Link to={user?.username ? `/profile/${user.username}` : '/'} className={styles.userInfo}>
            <Avatar
              src={user?.avatar_url}
              username={user?.username}
              size="large"
              className={styles.userAvatar}
            />
            <div className={styles.userDetails}>
              <span className={styles.username}>{user?.username}</span>
              <span className={styles.displayName}>{user?.display_name}</span>
            </div>
          </Link>
          
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
