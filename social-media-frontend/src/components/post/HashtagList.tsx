import { Link } from 'react-router-dom';
import styles from './HashtagList.module.css';

interface HashtagListProps {
  hashtags: string[];
  limit?: number;
}

export const HashtagList: React.FC<HashtagListProps> = ({
  hashtags,
  limit,
}) => {
  const displayHashtags = limit ? hashtags.slice(0, limit) : hashtags;
  const remaining = limit && hashtags.length > limit ? hashtags.length - limit : 0;

  return (
    <div className={styles.hashtagList}>
      {displayHashtags.map((tag) => (
        <Link
          key={tag}
          to={`/explore?tag=${tag}`}
          className={styles.hashtag}
        >
          #{tag}
        </Link>
      ))}
      {remaining > 0 && (
        <span className={styles.more}>+{remaining}</span>
      )}
    </div>
  );
};