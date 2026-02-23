import { Link } from 'react-router-dom';
import { Button } from '@/components/common/Buttons/Button';
import styles from './EmptyFeed.module.css';

export const EmptyFeed = () => {
  return (
    <div className={styles.emptyFeed}>
      <div className={styles.icon}>📷</div>
      <h3 className={styles.title}>Il tuo feed è vuoto</h3>
      <p className={styles.message}>
        Segui altri utenti per vedere i loro post qui!
      </p>
      <Link to="/explore">
        <Button variant="primary">Esplora utenti</Button>
      </Link>
    </div>
  );
};