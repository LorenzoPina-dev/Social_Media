import { useState } from 'react';
import { Profile } from '@/types/user.types';
import { Post } from '@/types/post.types';
import { ProfilePosts } from './ProfilePosts';
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

  const tabs: TabItem[] = [
    { id: 'posts', label: 'Post', icon: '📷' },
    ...(isOwnProfile ? [{ id: 'saved' as const, label: 'Salvati', icon: '🔖' }] : []),
    { id: 'tagged', label: 'Taggati', icon: '🏷️' },
  ];

  const handleTabClick = (tabId: Tab) => {
    setActiveTab(tabId);
  };

  return (
    <div className={styles.tabs}>
      <div className={styles.tabHeader}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'posts' && <ProfilePosts posts={posts} />}
        {activeTab === 'saved' && (
          <div className={styles.comingSoon}>
            <span className={styles.comingSoonIcon}>🔖</span>
            <h3 className={styles.comingSoonTitle}>Post salvati</h3>
            <p className={styles.comingSoonText}>
              Questa funzionalità sarà disponibile a breve
            </p>
          </div>
        )}
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