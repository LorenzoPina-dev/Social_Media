import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Notification } from '@/types/notification.types';
import { Avatar } from '@/components/common/Avatar/Avatar';
import styles from './NotificationItem.module.css';

interface NotificationItemProps {
  notification: Notification;
  onClick?: () => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClick,
}) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'LIKE':
        return '❤️';
      case 'COMMENT':
        return '💬';
      case 'FOLLOW':
        return '👤';
      case 'MENTION':
        return '@';
      case 'SHARE':
        return '🔄';
      default:
        return '🔔';
    }
  };

  const getLink = () => {
    if (notification.type === 'SYSTEM') {
      const conversationId =
        (notification.data?.conversationId as string | undefined) ??
        notification.entity_id;
      return conversationId ? `/messages/${conversationId}` : '/messages';
    }

    if (notification.entity_type === 'POST' && notification.entity_id) {
      return `/p/${notification.entity_id}`;
    }
    if (notification.entity_type === 'USER' && notification.entity_id) {
      return `/profile/${notification.entity_id}`;
    }
    return '#';
  };

  return (
    <Link
      to={getLink()}
      className={`${styles.item} ${!notification.read ? styles.unread : ''}`}
      onClick={onClick}
    >
      <div className={styles.avatar}>
        {notification.actor ? (
          <Avatar
            src={notification.actor.avatar_url}
            username={notification.actor.username}
            size="small"
          />
        ) : (
          <div className={styles.iconPlaceholder}>{getIcon()}</div>
        )}
      </div>

      <div className={styles.content}>
        <div className={styles.text}>
          {notification.actor && (
            <span className={styles.username}>
              {notification.actor.username}
            </span>
          )}
          <span className={styles.message}>{notification.body}</span>
        </div>

        <span className={styles.time}>
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
            locale: it,
          })}
        </span>
      </div>

      {!notification.read && <span className={styles.unreadDot} />}
    </Link>
  );
};
