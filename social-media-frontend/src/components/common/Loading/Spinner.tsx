import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'white' | 'gray';
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'medium',
  color = 'primary',
}) => {
  const sizeMap = {
    small: 16,
    medium: 24,
    large: 40,
  };

  const dimension = sizeMap[size];

  return (
    <svg
      className={`${styles.spinner} ${styles[size]} ${styles[color]}`}
      viewBox="0 0 24 24"
      width={dimension}
      height={dimension}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className={styles.circle}
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
};