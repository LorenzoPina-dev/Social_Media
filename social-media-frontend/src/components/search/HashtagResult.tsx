import { Hashtag } from '@/types/post.types';
import styles from './HashtagResult.module.css';

interface HashtagResultProps {
  hashtag: Hashtag;
  onClick?: () => void;
}

export const HashtagResult: React.FC<HashtagResultProps> = ({
  hashtag,
  onClick,
}) => {
  return (
    <div className={styles.hashtagResult} onClick={onClick}>
      <div className={styles.icon}>
        <svg viewBox="0 0 24 24">
          <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm0 2.66l-8.88 8.88-1.3-1.3 1.42-1.41 2.47 2.47 7.09-7.09-1.41-1.42z"/>
        </svg>
      </div>
      
      <div className={styles.info}>
        <span className={styles.tag}>#{hashtag.tag}</span>
        <span className={styles.count}>
          {hashtag.post_count.toLocaleString('it-IT')} post
        </span>
      </div>
    </div>
  );
};