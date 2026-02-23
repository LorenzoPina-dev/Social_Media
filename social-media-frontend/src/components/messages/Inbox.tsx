import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { getConversations } from '@/api/messages';
import styles from './Inbox.module.css';

interface Conversation {
  id: string;
  participant: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    verified: boolean;
  };
  lastMessage: {
    content: string;
    created_at: string;
    sender_id: string;
    read: boolean;
  };
  unreadCount: number;
  updated_at: string;
}

export const Inbox: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await getConversations();
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>💬</div>
        <h3 className={styles.emptyTitle}>Nessuna conversazione</h3>
        <p className={styles.emptyText}>
          Inizia a seguire altri utenti per mandare messaggi
        </p>
      </div>
    );
  }

  return (
    <div className={styles.inbox}>
      {conversations.map((conversation) => (
        <Link
          key={conversation.id}
          to={`/messages/${conversation.id}`}
          className={`${styles.conversation} ${
            conversation.unreadCount > 0 ? styles.unread : ''
          }`}
        >
          <Avatar
            src={conversation.participant.avatar_url}
            username={conversation.participant.username}
            size="medium"
          />
          
          <div className={styles.info}>
            <div className={styles.header}>
              <span className={styles.username}>
                {conversation.participant.username}
                {conversation.participant.verified && (
                  <span className={styles.verifiedBadge}>✓</span>
                )}
              </span>
              <span className={styles.timestamp}>
                {formatDistanceToNow(new Date(conversation.updated_at), {
                  addSuffix: true,
                  locale: it,
                })}
              </span>
            </div>
            
            <div className={styles.preview}>
              {conversation.lastMessage.sender_id === user?.id && (
                <span className={styles.you}>Tu: </span>
              )}
              <span className={styles.message}>
                {conversation.lastMessage.content}
              </span>
            </div>
          </div>

          {conversation.unreadCount > 0 && (
            <span className={styles.unreadBadge}>
              {conversation.unreadCount}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
};