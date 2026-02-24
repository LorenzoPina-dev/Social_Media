import { useSearchParams, useNavigate } from 'react-router-dom';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
import { useSearch } from '@/hooks/useSearch';
import styles from './SearchPage.module.css';
import { useEffect } from 'react';

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  
  const {
    users,
    posts,
    hashtags,
    isLoading,
    search,
    setUserFollowState,
  } = useSearch();

  useEffect(() => {
    if (query) {
      search(query);
    }
  }, [query, search]);

  useEffect(() => {
    if (!query) return;

    const interval = setInterval(() => {
      search(query, { silent: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [query, search]);

  return (
    <div className={styles.searchPage}>
      <div className={styles.header}>
        <h1 className={styles.title}>Ricerca</h1>
        <SearchBar />
      </div>

      {query ? (
        <SearchResults
          query={query}
          users={users}
          posts={posts}
          hashtags={hashtags}
          isLoading={isLoading}
          onFollowChange={setUserFollowState}
          onUserClick={(username) => navigate(`/profile/${username}`)}
          onPostClick={(postId) => navigate(`/p/${postId}`)}
          onHashtagClick={(tag) => navigate(`/explore/tags/${tag}`)}
        />
      ) : (
        <div className={styles.recentSearches}>
          <h2 className={styles.recentTitle}>Ricerche recenti</h2>
          {/* Recent searches would go here */}
        </div>
      )}
    </div>
  );
};

export default SearchPage
