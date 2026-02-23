import styles from './ErrorFallback.module.css';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  const handleReset = () => {
    if (resetError) {
      resetError();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.icon}>⚠️</div>
      <h2 className={styles.title}>Qualcosa è andato storto</h2>
      <p className={styles.message}>
        {error?.message || 'Si è verificato un errore imprevisto'}
      </p>
      <button className={styles.button} onClick={handleReset}>
        Riprova
      </button>
    </div>
  );
};