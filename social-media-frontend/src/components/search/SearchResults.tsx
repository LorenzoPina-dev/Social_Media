import { useState } from 'react';
import { UserResult } from './UserResult';
import { PostResult } from './PostResult';
import { HashtagResult } from './HashtagResult';
import { Profile } from '@/types/user.types';
import { Post } from '@/types/post.types';
import { Hashtag } from '@/types/post.types';
import styles from './SearchResults.module.css';

type Tab = 'top' | 'people' | 'posts' | 'hashtags';

interface SearchResultsProps {
  query: string;
  users?: Profile[];
  posts?: Post[];
  hashtags?: Hashtag[];
  isLoading?: boolean;
  onFollowChange?: (userId: string, isFollowing: boolean) => void;
  onUserClick?: (username: string) => void;
  onPostClick?: (postId: string) => void;
  onHashtagClick?: (tag: string) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  query,
  users = [],
  posts = [],
  hashtags = [],
  isLoading = false,
  onFollowChange,
  onUserClick,
  onPostClick,
  onHashtagClick,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('top');

  const tabs = [
    { id: 'top', label: 'Top', count: null },
    { id: 'people', label: 'Persone', count: users.length },
    { id: 'posts', label: 'Post', count: posts.length },
    { id: 'hashtags', label: 'Hashtag', count: hashtags.length },
  ] as const;

  const renderResults = () => {
    if (isLoading) {
      return (
        <div className={styles.loading}>
          <div className={styles.spinner} />
        </div>
      );
    }

    if (activeTab === 'top') {
      return (
        <div className={styles.topResults}>
          {users.slice(0, 3).map((user) => (
            <UserResult
              key={user.id}
              user={user}
              onClick={() => onUserClick?.(user.username)}
              onFollow={() => onFollowChange?.(user.id, true)}
              onUnfollow={() => onFollowChange?.(user.id, false)}
            />
          ))}
          {posts.slice(0, 3).map((post) => (
            <PostResult
              key={post.id}
              post={post}
              onClick={() => onPostClick?.(post.id)}
            />
          ))}
          {hashtags.slice(0, 3).map((hashtag) => (
            <HashtagResult
              key={hashtag.id}
              hashtag={hashtag}
              onClick={() => onHashtagClick?.(hashtag.tag)}
            />
          ))}
        </div>
      );
    }

    if (activeTab === 'people') {
      return users.map((user) => (
        <UserResult
          key={user.id}
          user={user}
          onClick={() => onUserClick?.(user.username)}
          onFollow={() => onFollowChange?.(user.id, true)}
          onUnfollow={() => onFollowChange?.(user.id, false)}
        />
      ));
    }

    if (activeTab === 'posts') {
      return posts.map((post) => (
        <PostResult
          key={post.id}
          post={post}
          onClick={() => onPostClick?.(post.id)}
        />
      ));
    }

    if (activeTab === 'hashtags') {
      return hashtags.map((hashtag) => (
        <HashtagResult
          key={hashtag.id}
          hashtag={hashtag}
          onClick={() => onHashtagClick?.(hashtag.tag)}
        />
      ));
    }

    return null;
  };

  return (
    <div className={styles.results}>
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className={styles.count}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.resultsList}>
        {renderResults()}
      </div>

      {!isLoading &&
        users.length === 0 &&
        posts.length === 0 &&
        hashtags.length === 0 && (
          <div className={styles.empty}>
            <p>Nessun risultato trovato per "{query}"</p>
          </div>
        )}
    </div>
  );
};
