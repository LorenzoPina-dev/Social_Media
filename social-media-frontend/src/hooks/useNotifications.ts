import { useNotifications as useNotificationsContext } from '@/contexts/NotificationContext';

export const useNotifications = () => {
  return useNotificationsContext();
};