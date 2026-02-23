import { Spinner } from './Spinner';
import styles from './PageLoader.module.css';

export const PageLoader = () => {
  return (
    <div className={styles.pageLoader}>
      <Spinner size="large" />
    </div>
  );
};