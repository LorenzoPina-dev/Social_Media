import { useState, useEffect } from 'react';
import { Profile } from '@/types/user.types';
import { Post } from '@/types/post.types';
import { ProfilePosts } from './ProfilePosts';
import { getSavedPosts } from '@/api/posts';
import { unwrapCursorPage } from '@/api/envelope';
import { Spinner } from '@/components/common/Loading/Spinner';
import styles from './ProfileTabs.module.css';

interface ProfileTabsProps {
  posts: Post[];
  profile: Profile;
  isOwnProfile: boolean;
}

type Tab = 'posts' | 'saved' | 'tagged';

interface TabItem {
  id: Tab;
  label: string;
  icon: string;
}

export const ProfileTabs: React.FC<ProfileTabsProps> = ({
  posts,
  profile,
  isOwnProfile,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('posts');

  // ── Saved posts state ────────────────────────────────────────────────────
  const [savedPosts, setSavedPosts]       = useState<Post[]>([]);
  const [savedLoading, setSavedLoading]   = useState(false);
  const [savedLoaded, setSavedLoaded]     = useState(false);
  const [savedCursor, setSavedCursor]     = useState<string | undefined>(undefined);
  const [savedHasMore, setSavedHasMore]   = useState(false);

  const loadSavedPosts = async (reset = false) => {
    if (savedLoading) return;
    setSavedLoading(true);
    try {
      const response = await getSavedPosts({
        cursor: reset ? undefined : savedCursor,
        limit: 12,
      });
      const page = unwrapCursorPage<Post>(response.data);
      setSavedPosts(prev => reset ? page.items : [...prev, ...page.items]);
      setSavedCursor(page.cursor ?? undefined);
      setSavedHasMore(page.has_more);
      setSavedLoaded(true);
    } catch (err) {
      console.error('Failed to load saved posts:', err);
      setSavedLoaded(true);
    } finally {
      setSavedLoading(false);
    }
  };

  // Load saved posts the first time the tab is opened
  useEffect(() => {
    if (activeTab === 'saved' && isOwnProfile && !savedLoaded) {
      loadSavedPosts(true);
    }
  }, [activeTab]);

  // ── Tabs config ──────────────────────────────────────────────────────────
  const tabs: TabItem[] = [
    { id: 'posts',  label: 'Post',    icon: '📷' },
    ...(isOwnProfile ? [{ id: 'saved' as const, label: 'Salvati', icon: '🔖' }] : []),
    { id: 'tagged', label: 'Taggati', icon: '🏷️' },
  ];

  return (
    <div className={styles.tabs}>
      <div className={styles.tabHeader}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {/* ── Post ── */}
        {activeTab === 'posts' && <ProfilePosts posts={posts} />}

        {/* ── Salvati ── */}
        {activeTab === 'saved' && (
          <>
            {savedLoading && savedPosts.length === 0 ? (
              <div className={styles.loadingCenter}>
                <Spinner size="medium" />
              </div>
            ) : (
              <>
                <ProfilePosts posts={savedPosts} />

                {savedHasMore && (
                  <div className={styles.loadMore}>
                    <button
                      className={styles.loadMoreButton}
                      onClick={() => loadSavedPosts(false)}
                      disabled={savedLoading}
                    >
                      {savedLoading ? <Spinner size="small" /> : 'Carica altri'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Taggati ── */}
        {activeTab === 'tagged' && (
          <div className={styles.comingSoon}>
            <span className={styles.comingSoonIcon}>🏷️</span>
            <h3 className={styles.comingSoonTitle}>Post in cui sei taggato</h3>
            <p className={styles.comingSoonText}>
              Questa funzionalità sarà disponibile a breve
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
