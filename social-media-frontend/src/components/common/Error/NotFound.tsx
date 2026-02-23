import { Link } from 'react-router-dom';
import styles from './NotFound.module.css';

export const NotFound = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.code}>404</h1>
      <h2 className={styles.title}>Pagina non trovata</h2>
      <p className={styles.message}>
        La pagina che stai cercando non esiste o è stata rimossa.
      </p>
      <Link to="/" className={styles.homeLink}>
        Torna alla home
      </Link>
    </div>
  );
};