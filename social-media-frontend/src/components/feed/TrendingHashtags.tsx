import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTrendingHashtags } from '@/api/posts';
import { TrendingHashtag } from '@/types/post.types';
import styles from './TrendingHashtags.module.css';

export const TrendingHashtags = () => {
  const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrendingHashtags();
  }, []);

  const loadTrendingHashtags = async () => {
    try {
      const response = await getTrendingHashtags();
      setHashtags(response.data);
    } catch (error) {
      console.error('Failed to load trending hashtags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.trending}>
        <h3 className={styles.title}>Hashtag in tendenza</h3>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (hashtags.length === 0) {
    return null;
  }

  return (
    <div className={styles.trending}>
      <h3 className={styles.title}>Hashtag in tendenza</h3>
      {hashtags.map((hashtag) => (
        <Link
          key={hashtag.id}
          to={`/explore?tag=${hashtag.tag}`}
          className={styles.hashtag}
        >
          <span className={styles.tag}>#{hashtag.tag}</span>
          <span className={styles.count}>
            {hashtag.post_count.toLocaleString('it-IT')} post
          </span>
          {hashtag.trend > 0 && (
            <span className={styles.trend}>
              +{hashtag.trend}%
            </span>
          )}
        </Link>
      ))}
    </div>
  );
};