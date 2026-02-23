import { useSearchParams } from 'react-router-dom';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
import { useSearch } from '@/hooks/useSearch';
import styles from './SearchPage.module.css';
import { useEffect } from 'react';

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const {
    users,
    posts,
    hashtags,
    isLoading,
    search,
  } = useSearch();

  useEffect(() => {
    if (query) {
      search(query);
    }
  }, [query]);

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