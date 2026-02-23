import { useParams } from 'react-router-dom';
import { Inbox } from '@/components/messages/Inbox';
import { Conversation } from '@/components/messages/Conversation';
import { useIsMobile } from '@/hooks/useMediaQuery';
import styles from './MessagesPage.module.css';

const MessagesPage = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={styles.messagesPage}>
        {conversationId ? (
          <Conversation />
        ) : (
          <Inbox />
        )}
      </div>
    );
  }

  return (
    <div className={styles.messagesPageDesktop}>
      <div className={styles.inboxColumn}>
        <Inbox />
      </div>
      <div className={styles.conversationColumn}>
        {conversationId ? (
          <Conversation />
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💬</div>
            <h3 className={styles.emptyTitle}>I tuoi messaggi</h3>
            <p className={styles.emptyText}>
              Seleziona una conversazione per iniziare a chattare
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage