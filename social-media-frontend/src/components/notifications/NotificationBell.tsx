import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IconButton } from '@/components/common/Buttons/IconButton';
import { NotificationList } from './NotificationList';
import { useNotifications } from '@/hooks/useNotifications';
import styles from './NotificationBell.module.css';

interface NotificationBellProps {
  count?: number;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ count = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notificationId: string) => {
    markAsRead(notificationId);
    setIsOpen(false);
  };

  const handleViewAll = () => {
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={bellRef}>
      <IconButton
        onClick={() => setIsOpen(!isOpen)}
        label="Notifiche"
        className={styles.bellButton}
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        {count > 0 && <span className={styles.badge}>{count > 99 ? '99+' : count}</span>}
      </IconButton>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h3 className={styles.title}>Notifiche</h3>
            {notifications.length > 0 && (
              <button
                className={styles.markAllRead}
                onClick={markAllAsRead}
              >
                Segna tutte come lette
              </button>
            )}
          </div>

          <NotificationList
            notifications={notifications.slice(0, 5)}
            onNotificationClick={handleNotificationClick}
          />

          <Link
            to="/notifications"
            className={styles.viewAll}
            onClick={handleViewAll}
          >
            Vedi tutte le notifiche
          </Link>
        </div>
      )}
    </div>
  );
};