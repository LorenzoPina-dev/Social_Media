import { Notification } from '@/types/notification.types';
import { NotificationItem } from './NotificationItem';
import styles from './NotificationList.module.css';

interface NotificationListProps {
  notifications: Notification[];
  onNotificationClick?: (notificationId: string) => void;
  showEmpty?: boolean;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onNotificationClick,
  showEmpty = true,
}) => {
  if (notifications.length === 0 && showEmpty) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🔔</div>
        <p className={styles.emptyText}>Nessuna notifica</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClick={() => onNotificationClick?.(notification.id)}
        />
      ))}
    </div>
  );
};