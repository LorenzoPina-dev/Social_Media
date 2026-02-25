import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/hooks/useNotifications';
import { useModal } from '@/contexts/ModalContext';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { SearchBar } from '@/components/search/SearchBar';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { CreatePostModal } from '@/components/post/CreatePost/CreatePostModal';
import styles from './Navbar.module.css';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  useTheme();
  const { unreadCount } = useNotifications();
  const [showMenu, setShowMenu] = useState(false);
  const navigate = useNavigate();
  const { openModal } = useModal();

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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <div className={styles.left}>
          <Link to="/" className={styles.logo}>
            <svg className={styles.logoIcon} viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
            <span className={styles.logoText}>SocialApp</span>
          </Link>
        </div>

        <div className={styles.center}>
          <SearchBar />
        </div>

        <div className={styles.right}>
          {isAuthenticated ? (
            <>
              <Link to="/" className={styles.navItem}>
                <svg viewBox="0 0 24 24">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
              </Link>

              <Link to="/explore" className={styles.navItem}>
                <svg viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4zm0 13c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>
              </Link>

              <div className={styles.navItem}>
                <NotificationBell count={unreadCount} />
              </div>

              <button
                className={styles.createButton}
                onClick={handleCreatePost}
                aria-label="Crea nuovo post"
                title="Crea post"
              >
                <svg viewBox="0 0 24 24">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </button>

              <Link to="/messages" className={styles.navItem}>
                <svg viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                </svg>
              </Link>

              <div className={styles.userMenu}>
                <button
                  className={styles.avatarButton}
                  onClick={() => setShowMenu(!showMenu)}
                >
                  <Avatar
                    src={user?.avatar_url}
                    username={user?.username}
                    size="small"
                  />
                </button>

                {showMenu && (
                  <div className={styles.dropdown}>
                    <Link
                      to={`/profile/${user?.username}`}
                      className={styles.dropdownItem}
                      onClick={() => setShowMenu(false)}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                      <span>Profilo</span>
                    </Link>
                    
                    <Link
                      to="/settings"
                      className={styles.dropdownItem}
                      onClick={() => setShowMenu(false)}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94 0 .31.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                      </svg>
                      <span>Impostazioni</span>
                    </Link>

                    <button
                      className={styles.dropdownItem}
                      onClick={handleLogout}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                      </svg>
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.authButtons}>
              <Link to="/login" className={styles.loginButton}>
                Accedi
              </Link>
              <Link to="/register" className={styles.registerButton}>
                Registrati
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
