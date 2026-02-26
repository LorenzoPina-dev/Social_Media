import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
import { Feed } from '@/components/feed/Feed';
import { getTrendingFeed } from '@/api/feed';
import { searchUsers, searchPosts, searchHashtags } from '@/api/search';
import { FeedPost } from '@/types/feed.types';
import { Profile } from '@/types/user.types';
import { Post } from '@/types/post.types';
import { Hashtag } from '@/types/post.types';
import { unwrapData, unwrapItems } from '@/api/envelope';
import styles from './ExplorePage.module.css';

const ExplorePage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const tag = searchParams.get('tag') || '';

  const [trendingPosts, setTrendingPosts] = useState<FeedPost[]>([]);
  const [isLoadingTrending, setIsLoadingTrending] = useState(true);

  const [users, setUsers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query && !tag) {
      loadTrendingFeed();
    }
  }, []);

  useEffect(() => {
    if (query) {
      performSearch();
    }
  }, [query]);

  useEffect(() => {
    if (tag) {
      // Load posts with specific hashtag
    }
  }, [tag]);

  const loadTrendingFeed = async () => {
    setIsLoadingTrending(true);
    try {
      const response = await getTrendingFeed('day');
      const payload = unwrapData<any>(response.data);
      const items = payload?.items ?? payload?.data ?? [];
      setTrendingPosts(Array.isArray(items) ? items : []);
    } catch (error) {
      console.error('Failed to load trending feed:', error);
    } finally {
      setIsLoadingTrending(false);
    }
  };

  const performSearch = async () => {
    setIsSearching(true);
    try {
      const [usersRes, postsRes, hashtagsRes] = await Promise.all([
        searchUsers({ q: query, limit: 10 }),
        searchPosts({ q: query, limit: 10 }),
        searchHashtags(query),
      ]);
      setUsers(unwrapItems<Profile>(usersRes.data));
      setPosts(unwrapItems<Post>(postsRes.data));
      setHashtags(unwrapItems<Hashtag>(hashtagsRes.data));
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={styles.explorePage}>
      <div className={styles.header}>
        <h1 className={styles.title}>Esplora</h1>
        <SearchBar />
      </div>

      {query ? (
        <SearchResults
          query={query}
          users={users}
          posts={posts}
          hashtags={hashtags}
          isLoading={isSearching}
          onUserClick={(username) => {
            window.location.href = `/profile/${username}`;
          }}
          onPostClick={(postId) => {
            window.location.href = `/p/${postId}`;
          }}
          onHashtagClick={(tag) => {
            window.location.href = `/explore?tag=${tag}`;
          }}
        />
      ) : tag ? (
        <div className={styles.tagFeed}>
          <h2 className={styles.tagTitle}>#{tag}</h2>
          <Feed />
        </div>
      ) : (
        <div className={styles.trending}>
          <h2 className={styles.trendingTitle}>In tendenza oggi</h2>
          <div className={styles.trendingGrid}>
            {trendingPosts.map((post) => (
              <div key={post.id} className={styles.trendingItem}>
                <h1>{JSON.stringify(post)}</h1>
                <img
                  src={post.media_urls?.[0].replace('urn:storage:', 'http://minio:9000/media/')|| '/default-post.jpg'}
                  alt=""
                  className={styles.trendingImage}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExplorePage
