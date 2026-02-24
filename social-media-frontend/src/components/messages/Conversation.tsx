import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
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

  useEffect(() => {
    if (conversationId) {
      loadConversation();
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket || !conversationId || !isConnected) return;

    const handleNewMessage = (message: Message) => {
      if (message.conversation_id === conversationId) {
        setMessages((prev) => [...prev, message]);
        
        if (message.sender_id !== user?.id) {
          markAsRead(conversationId, message.id).catch(console.error);
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
      if (data.conversationId === conversationId && data.userId !== user?.id) {
        setIsTyping(true);
      }
    };

    const handleTypingStop = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === conversationId && data.userId !== user?.id) {
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
  }, [socket, conversationId, isConnected, user?.id]);

  const loadConversation = async () => {
    setIsLoading(true);
    try {
      const [messagesRes, detailsRes] = await Promise.all([
        getMessages(conversationId!),
        getConversationDetails(conversationId!),
      ]);
      setMessages(messagesRes);
      setParticipant(detailsRes.participant as Participant);
      
      // Mark messages as read
      if (messagesRes.length > 0) {
        const unreadMessages = messagesRes.filter(
          (m) => m.sender_id !== user?.id && !m.read_at
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

  const handleSendMessage = async (content: string) => {
    if (!conversationId || !content.trim() || isSending) return;

    setIsSending(true);
    try {
      const newMessage = await sendMessage(conversationId, content);
      
      setMessages((prev) => [...prev, newMessage]);
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
                isOwn={message.sender_id === user?.id}
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
