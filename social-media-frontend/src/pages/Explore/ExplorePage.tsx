import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SearchBar } from '@/components/search/SearchBar';
import { SearchResults } from '@/components/search/SearchResults';
import { getTrendingFeed } from '@/api/feed';
import { searchUsers, searchPosts, searchHashtags } from '@/api/search';
import { FeedItem, FeedPostSummary } from '@/types/feed.types';
import { Profile } from '@/types/user.types';
import { Post, Hashtag } from '@/types/post.types';
import { unwrapData, unwrapItems } from '@/api/envelope';
import styles from './ExplorePage.module.css';

// ── Tile singolo della griglia ─────────────────────────────────────────────

interface ExploreTileProps {
  post: FeedPostSummary;
  onClick: () => void;
}

const ExploreTile: React.FC<ExploreTileProps> = ({ post, onClick }) => {
  const imageUrl = post.mediaUrls?.[0] ?? post.imageUrl ?? null;
  const isVideo  = post.mediaTypes?.[0] === 'video';

  return (
    <button className={styles.tile} onClick={onClick} aria-label="Apri post">
      {imageUrl ? (
        isVideo ? (
          <video
            src={imageUrl}
            className={styles.tileMedia}
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <img
            src={imageUrl}
            alt=""
            className={styles.tileMedia}
            loading="lazy"
          />
        )
      ) : (
        <div className={styles.tileText}>
          <p className={styles.tileTextContent}>{post.content}</p>
        </div>
      )}

      <div className={styles.tileOverlay}>
        <span className={styles.tileStat}>
          <svg viewBox="0 0 24 24" className={styles.tileIcon} aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          {post.likeCount ?? 0}
        </span>
        <span className={styles.tileStat}>
          <svg viewBox="0 0 24 24" className={styles.tileIcon} aria-hidden="true">
            <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/>
          </svg>
          {post.commentCount ?? 0}
        </span>
      </div>

      {isVideo && (
        <span className={styles.videoIndicator} aria-label="Video">
          <svg viewBox="0 0 24 24">
            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
          </svg>
        </span>
      )}

      {post.mediaUrls && post.mediaUrls.length > 1 && (
        <span className={styles.multipleIndicator} aria-label="Più foto">
          <svg viewBox="0 0 24 24">
            <path d="M22 16V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14a2 2 0 0 0 2 2h14v-2H4V6H2z"/>
          </svg>
        </span>
      )}
    </button>
  );
};

// ── Skeleton loader ────────────────────────────────────────────────────────

const GridSkeleton = () => (
  <div className={styles.grid}>
    {Array.from({ length: 12 }).map((_, i) => (
      <div key={i} className={styles.skeleton} />
    ))}
  </div>
);

// ── Pagina principale ──────────────────────────────────────────────────────

const ExplorePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const tag   = searchParams.get('tag') || '';

  // FeedItem[] dal feed-service: { postId, score, post: FeedPostSummary }
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);

  const [users,      setUsers]      = useState<Profile[]>([]);
  const [posts,      setPosts]      = useState<Post[]>([]);
  const [hashtags,   setHashtags]   = useState<Hashtag[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // ── Feed ─────────────────────────────────────────────────────────────────

  const loadFeed = useCallback(async () => {
    setIsLoadingFeed(true);
    try {
      const response = await getTrendingFeed('day');
      const payload  = unwrapData<any>(response.data);

      // Il feed-service restituisce { items: FeedItem[], nextCursor, hasMore, total }
      const raw: FeedItem[] = payload?.items ?? payload?.data ?? [];
      setFeedItems(Array.isArray(raw) ? raw : []);
    } catch (error) {
      console.error('Failed to load feed:', error);
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  // ── Search ───────────────────────────────────────────────────────────────

  const performSearch = useCallback(async () => {
    if (!query) return;
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
  }, [query]);

  useEffect(() => {
    if (!query && !tag) loadFeed();
  }, [query, tag, loadFeed]);

  useEffect(() => {
    if (query) performSearch();
  }, [query, performSearch]);

  // ── Post visibili nella griglia (solo quelli con post != null) ────────────

  const visibleItems = feedItems.filter((item): item is FeedItem & { post: FeedPostSummary } =>
    item.post != null
  );

  // ── Render ───────────────────────────────────────────────────────────────

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
          onUserClick={(username) => navigate(`/profile/${username}`)}
          onPostClick={(postId)   => navigate(`/p/${postId}`)}
          onHashtagClick={(t)     => navigate(`/explore?tag=${t}`)}
        />
      ) : tag ? (
        <div className={styles.tagSection}>
          <h2 className={styles.tagTitle}>
            <span className={styles.hashSign}>#</span>{tag}
          </h2>
        </div>
      ) : (
        <div className={styles.trending}>
          <h2 className={styles.sectionTitle}>In tendenza oggi</h2>

          {isLoadingFeed ? (
            <GridSkeleton />
          ) : visibleItems.length === 0 ? (
            <div className={styles.empty}>
              <svg viewBox="0 0 24 24" className={styles.emptyIcon}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
              <p>Nessun contenuto in tendenza al momento</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {visibleItems.map((item) => (
                <ExploreTile
                  key={item.postId}
                  post={item.post}
                  onClick={() => navigate(`/p/${item.postId}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExplorePage;
