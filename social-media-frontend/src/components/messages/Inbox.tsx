import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { getConversations, startConversation } from '@/api/messages';
import { getFollowers, getFollowing } from '@/api/users';
import { Conversation } from '@/types/message.types';
import { Profile } from '@/types/user.types';
import { unwrapItems } from '@/api/envelope';
import styles from './Inbox.module.css';

export const Inbox: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    void loadConversations();
  }, []);

  const loadConversations = async (): Promise<void> => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadContacts = async (): Promise<void> => {
    if (!user?.id) return;
    setIsContactsLoading(true);
    try {
      const [followersResponse, followingResponse] = await Promise.all([
        getFollowers(user.id, { limit: 100 }),
        getFollowing(user.id, { limit: 100 }),
      ]);

      const merged = [
        ...unwrapItems<Profile>(followersResponse.data),
        ...unwrapItems<Profile>(followingResponse.data),
      ];

      const unique = new Map<string, Profile>();
      for (const contact of merged) {
        if (contact.id !== user.id) {
          unique.set(contact.id, contact);
        }
      }
      setContacts(Array.from(unique.values()));
    } catch (error) {
      console.error('Failed to load contacts:', error);
      setContacts([]);
    } finally {
      setIsContactsLoading(false);
    }
  };

  const handleOpenCreate = async (): Promise<void> => {
    setIsCreateOpen(true);
    if (contacts.length === 0) {
      await loadContacts();
    }
  };

  const handleStartConversation = async (targetUserId: string): Promise<void> => {
    try {
      const result = await startConversation(targetUserId);
      navigate(`/messages/${result.conversation_id}`);
      setIsCreateOpen(false);
    } catch (error) {
      console.error('Failed to start conversation:', error);
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

  return (
    <div className={styles.wrapper}>
      <div className={styles.actions}>
        <button className={styles.newChatButton} onClick={() => void handleOpenCreate()}>
          +
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>Chat</div>
          <h3 className={styles.emptyTitle}>Nessuna conversazione</h3>
          <p className={styles.emptyText}>
            Premi + per iniziare a scrivere a follower o seguiti
          </p>
        </div>
      ) : (
        conversations.map((conversation) => (
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
                    <span className={styles.verifiedBadge}>v</span>
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
                {conversation.lastMessage?.sender_id === user?.id && (
                  <span className={styles.you}>Tu: </span>
                )}
                <span className={styles.message}>
                  {conversation.lastMessage?.content || 'Nessun messaggio'}
                </span>
              </div>
            </div>

            {conversation.unreadCount > 0 && (
              <span className={styles.unreadBadge}>
                {conversation.unreadCount}
              </span>
            )}
          </Link>
        ))
      )}

      {isCreateOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsCreateOpen(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Nuova chat</h3>
              <button onClick={() => setIsCreateOpen(false)} className={styles.closeButton}>
                x
              </button>
            </div>

            {isContactsLoading ? (
              <div className={styles.loadingContacts}>Caricamento contatti...</div>
            ) : contacts.length === 0 ? (
              <div className={styles.emptyContacts}>
                Nessun contatto disponibile. Segui qualcuno o fatti seguire.
              </div>
            ) : (
              <div className={styles.contactList}>
                {contacts.map((contact) => (
                  <button
                    key={contact.id}
                    className={styles.contactRow}
                    onClick={() => void handleStartConversation(contact.id)}
                  >
                    <Avatar src={contact.avatar_url} username={contact.username} size="small" />
                    <span>{contact.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
