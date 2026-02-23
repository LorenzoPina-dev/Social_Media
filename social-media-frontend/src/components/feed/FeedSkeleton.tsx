import { Skeleton } from '@/components/common/Loading/Skeleton';
import styles from './FeedSkeleton.module.css';

interface FeedSkeletonProps {
  count?: number;
}

export const FeedSkeleton: React.FC<FeedSkeletonProps> = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <article key={index} className={styles.skeleton}>
          <div className={styles.header}>
            <Skeleton width={40} height={40} borderRadius="50%" />
            <div className={styles.userInfo}>
              <Skeleton width={120} height={16} />
              <Skeleton width={80} height={12} />
            </div>
          </div>
          
          <Skeleton width="100%" height={400} />
          
          <div className={styles.content}>
            <Skeleton width="80%" height={16} />
            <Skeleton width="60%" height={16} />
          </div>
          
          <div className={styles.actions}>
            <Skeleton width={24} height={24} borderRadius="50%" />
            <Skeleton width={24} height={24} borderRadius="50%" />
            <Skeleton width={24} height={24} borderRadius="50%" />
          </div>
        </article>
      ))}
    </>
  );
};