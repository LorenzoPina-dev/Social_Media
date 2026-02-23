import { Link } from 'react-router-dom';
import styles from './PostStats.module.css';

interface PostStatsProps {
  postId: string;
  likeCount: number;
  commentCount: number;
  shareCount?: number;
}

export const PostStats: React.FC<PostStatsProps> = ({
  postId,
  likeCount,
  commentCount,
  shareCount = 0,
}) => {
  return (
    <div className={styles.stats}>
      <Link to={`/p/${postId}/likes`} className={styles.stat}>
        <span className={styles.count}>{likeCount.toLocaleString('it-IT')}</span>
        <span className={styles.label}>mi piace</span>
      </Link>
      
      <Link to={`/p/${postId}`} className={styles.stat}>
        <span className={styles.count}>{commentCount.toLocaleString('it-IT')}</span>
        <span className={styles.label}>commenti</span>
      </Link>
      
      {shareCount > 0 && (
        <div className={styles.stat}>
          <span className={styles.count}>{shareCount.toLocaleString('it-IT')}</span>
          <span className={styles.label}>condivisioni</span>
        </div>
      )}
    </div>
  );
};