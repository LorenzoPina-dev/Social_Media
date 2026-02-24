import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { Notification } from '@/types/notification.types';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/api/notifications';
import toast from 'react-hot-toast';
import { unwrapItems } from '@/api/envelope';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { socket, isConnected } = useSocket();
  const { isAuthenticated } = useAuth();

  // Aggiorna conteggio non lette
  useEffect(() => {
    const count = notifications.filter(n => !n.read).length;
    setUnreadCount(count);
  }, [notifications]);

  const refreshNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getNotifications({ limit: 20 });
      setNotifications(unwrapItems<Notification>(response.data));
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carica notifiche iniziali + fallback polling
  useEffect(() => {
    if (!isAuthenticated) return;

    refreshNotifications();
    const pollId = window.setInterval(() => {
      void refreshNotifications();
    }, 8000);

    return () => {
      window.clearInterval(pollId);
    };
  }, [isAuthenticated, refreshNotifications]);

  // Ascolta nuove notifiche via socket
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewNotification = (notification: Notification) => {
      const normalized: Notification = {
        ...notification,
        read: notification.read ?? false,
        updated_at: notification.updated_at ?? notification.created_at,
        user_id: notification.user_id ?? '',
      };

      setNotifications(prev => {
        if (prev.some((n) => n.id === normalized.id)) {
          return prev;
        }
        return [normalized, ...prev];
      });

      if (normalized.type === 'SYSTEM') {
        window.dispatchEvent(
          new CustomEvent('chat:message', {
            detail: {
              conversationId:
                (normalized.data?.conversationId as string | undefined) ??
                normalized.entity_id,
              notificationId: normalized.id,
            },
          })
        );
      }
      
      // Mostra toast per nuove notifiche
      toast.custom(() => (
        <div className="notification-toast">
          <strong>{normalized.title}</strong>
          <p>{normalized.body}</p>
        </div>
      ), { duration: 5000 });
    };

    socket.on('notification', handleNewNotification);
    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket, isConnected]);

  const markAsRead = async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
        )
      );
      
      if (socket && isConnected) {
        socket.emit('notification:read', notificationId);
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true, read_at: new Date().toISOString() }))
      );
      
      if (socket && isConnected) {
        socket.emit('notification:readAll');
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};
