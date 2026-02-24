import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { jwtDecode } from 'jwt-decode';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import {
  getMessages,
  sendMessage,
  markAsRead,
  getConversationDetails,
} from '@/api/messages';
import styles from './Conversation.module.css';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
}

interface Participant {
  id: string;
  username: string;
  display_name?: string;
  avatar_url: string | null;
  verified: boolean;
  is_online?: boolean;
}

interface JwtPayload {
  userId?: string;
  sub?: string;
}

export const Conversation: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentUserId = user?.id || (() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return undefined;
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return decoded.userId || decoded.sub;
    } catch {
      return undefined;
    }
  })();

  const normalizeMessage = (raw: any): Message => ({
    id: raw.id,
    conversation_id: raw.conversation_id ?? raw.conversationId ?? '',
    sender_id: raw.sender_id ?? raw.senderId ?? '',
    content: raw.content ?? '',
    created_at: raw.created_at ?? raw.createdAt ?? new Date().toISOString(),
    read_at: raw.read_at ?? raw.readAt ?? null,
  });

  const mergeById = (previous: Message[], next: Message[]): Message[] => {
    const merged = new Map<string, Message>();
    for (const msg of previous) merged.set(msg.id, msg);
    for (const msg of next) merged.set(msg.id, msg);
    return Array.from(merged.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  };

  const isOwnMessage = (message: Message): boolean => {
    if (participant?.id) {
      return message.sender_id !== participant.id;
    }
    if (currentUserId) {
      return message.sender_id === currentUserId;
    }
    return false;
  };

  useEffect(() => {
    if (conversationId) {
      loadConversation();
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const handleChatMessage = (event: Event) => {
      const customEvent = event as CustomEvent<{ conversationId?: string }>;
      const incomingConversationId = customEvent.detail?.conversationId;
      if (incomingConversationId && incomingConversationId === conversationId) {
        void refreshMessages();
      }
    };

    window.addEventListener('chat:message', handleChatMessage as EventListener);
    const pollId = window.setInterval(() => {
      void refreshMessages();
    }, 3000);

    return () => {
      window.removeEventListener('chat:message', handleChatMessage as EventListener);
      window.clearInterval(pollId);
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket || !conversationId || !isConnected) return;

    const handleNewMessage = (message: Message) => {
      const normalized = normalizeMessage(message);
      if (normalized.conversation_id === conversationId) {
        setMessages((prev) => mergeById(prev, [normalized]));
        
        if (normalized.sender_id !== currentUserId) {
          markAsRead(conversationId, normalized.id).catch(console.error);
        }
      }
    };

    const handleMessageRead = (data: { conversationId: string; messageId: string }) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === data.messageId ? { ...msg, read_at: new Date().toISOString() } : msg
          )
        );
      }
    };

    const handleTypingStart = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === conversationId && data.userId !== currentUserId) {
        setIsTyping(true);
      }
    };

    const handleTypingStop = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === conversationId && data.userId !== currentUserId) {
        setIsTyping(false);
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:read', handleMessageRead);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleMessageRead);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, conversationId, isConnected, currentUserId, participant?.id]);

  const loadConversation = async () => {
    setIsLoading(true);
    try {
      const [messagesRes, detailsRes] = await Promise.all([
        getMessages(conversationId!),
        getConversationDetails(conversationId!),
      ]);
      setMessages(messagesRes.map(normalizeMessage));
      setParticipant(detailsRes.participant as Participant);
      
      // Mark messages as read
      if (messagesRes.length > 0) {
        const unreadMessages = messagesRes.map(normalizeMessage).filter(
          (m) => m.sender_id !== currentUserId && !m.read_at
        );
        for (const msg of unreadMessages) {
          await markAsRead(conversationId!, msg.id);
          socket?.emit('message:read', { conversationId: conversationId!, messageId: msg.id });
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      navigate('/messages');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshMessages = async () => {
    if (!conversationId) return;
    try {
      const latest = await getMessages(conversationId);
      const normalizedLatest = latest.map(normalizeMessage);
      setMessages((prev) => {
        if (
          normalizedLatest.length === prev.length &&
          normalizedLatest[normalizedLatest.length - 1]?.id === prev[prev.length - 1]?.id
        ) {
          return prev;
        }
        return mergeById(prev, normalizedLatest);
      });

      const unreadMessages = normalizedLatest.filter(
        (m) => m.sender_id !== currentUserId && !m.read_at
      );
      for (const msg of unreadMessages) {
        await markAsRead(conversationId, msg.id);
      }
    } catch (error) {
      console.error('Failed to refresh conversation messages:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!conversationId || !content.trim() || isSending) return;

    setIsSending(true);
    try {
      const newMessage = await sendMessage(conversationId, content);
      
      setMessages((prev) => mergeById(prev, [normalizeMessage(newMessage)]));
      window.dispatchEvent(
        new CustomEvent('chat:message', { detail: { conversationId } })
      );
      socket?.emit('message:send', { conversationId, content });
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleTyping = (isTypingNow: boolean) => {
    if (!conversationId) return;
    
    if (isTypingNow) {
      socket?.emit('typing:start', conversationId);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        socket?.emit('typing:stop', conversationId);
      }, 2000);
    } else {
      socket?.emit('typing:stop', conversationId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!participant) {
    return null;
  }

  return (
    <div className={styles.conversation}>
      <div className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => navigate('/messages')}
        >
          <svg viewBox="0 0 24 24">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        
        <Avatar
          src={participant.avatar_url}
          username={participant.username}
          size="small"
        />
        
        <div className={styles.userInfo}>
          <span className={styles.username}>
            {participant.username}
            {participant.verified && (
              <span className={styles.verifiedBadge}>✓</span>
            )}
          </span>
          {participant.is_online && (
            <span className={styles.onlineStatus}>Online</span>
          )}
        </div>
      </div>

      <div className={styles.messages}>
        {messages.map((message, index) => {
          const showDate = index === 0 ||
            new Date(message.created_at).toDateString() !==
            new Date(messages[index - 1].created_at).toDateString();

          return (
            <div key={message.id}>
              {showDate && (
                <div className={styles.dateDivider}>
                  {format(new Date(message.created_at), 'dd MMMM yyyy', { locale: it })}
                </div>
              )}
              <MessageBubble
                message={message}
                isOwn={isOwnMessage(message)}
              />
            </div>
          );
        })}
        
        {isTyping && (
          <div className={styles.typingIndicator}>
            <span>{participant.username} sta scrivendo</span>
            <span className={styles.typingDots}>...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        disabled={isSending}
      />
    </div>
  );
};
