import { NotificationList } from '@/components/notifications/NotificationList';
import { Button } from '@/components/common/Buttons/Button';
import { useNotifications } from '@/hooks/useNotifications';
import styles from './NotificationsPage.module.css';

const NotificationsPage = () => {
  const {
    notifications,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();


  const handleNotificationClick = (notificationId: string) => {
    markAsRead(notificationId);
  };

  return (
    <div className={styles.notificationsPage}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notifiche</h1>
        {notifications.length > 0 && (
          <Button variant="ghost" size="small" onClick={markAllAsRead}>
            Segna tutte come lette
          </Button>
        )}
      </div>

      <NotificationList
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        showEmpty
      />
    </div>
  );
};

export default NotificationsPage