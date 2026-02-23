import { useState } from 'react';
import styles from './Avatar.module.css';

export interface AvatarProps {
  src?: string | null;
  username?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  showStatus?: boolean;
  isOnline?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  username,
  size = 'medium',
  showStatus = false,
  isOnline = false,
  className = '',
  onClick,
}) => {
  const [error, setError] = useState(false);

  const getInitials = () => {
    if (!username) return '?';
    return username.charAt(0).toUpperCase();
  };

  const getColorFromUsername = () => {
    if (!username) return '#ccc';
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#D4A5A5', '#9B59B6', '#3498DB'];
    const index = username.length % colors.length;
    return colors[index];
  };

  return (
    <div
      className={`${styles.avatar} ${styles[size]} ${onClick ? styles.clickable : ''} ${className}`}
      onClick={onClick}
      style={{ backgroundColor: !src || error ? getColorFromUsername() : undefined }}
    >
      {src && !error ? (
        <img
          src={src}
          alt={username || 'avatar'}
          className={styles.image}
          onError={() => setError(true)}
        />
      ) : (
        <span className={styles.initials}>{getInitials()}</span>
      )}
      
      {showStatus && (
        <span
          className={`${styles.status} ${isOnline ? styles.online : styles.offline}`}
        />
      )}
    </div>
  );
};