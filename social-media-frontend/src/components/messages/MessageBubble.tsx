import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    created_at: string;
    read_at: string | null;
    sender_id: string;
  };
  isOwn: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
}) => {
  const time = format(new Date(message.created_at), 'HH:mm', { locale: it });

  return (
    <div className={`${styles.bubble} ${isOwn ? styles.own : styles.other}`}>
      <div className={styles.content}>
        <p className={styles.text}>{message.content}</p>
        <div className={styles.metadata}>
          <span className={styles.time}>{time}</span>
          {isOwn && message.read_at && (
            <span className={styles.readReceipt}>
              <svg viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};