import { apiClient } from './client';
import {
  Notification,
  NotificationPreference,
  UpdateNotificationPreferenceRequest,
} from '@/types/notification.types';
import { CursorParams, PaginatedResponse } from '@/types/api.types';

// Notifications
export const getNotifications = async (params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Notification>>('/api/v1/notifications/', {
    params,
  });
};

export const getUnreadCount = async () => {
  return apiClient.get<{ count: number }>('/api/v1/notifications/unread-count');
};

export const markNotificationAsRead = async (id: string) => {
  return apiClient.put(`/api/v1/notifications/${id}/read`);
};

export const markAllNotificationsAsRead = async () => {
  return apiClient.put('/api/v1/notifications/read-all');
};

// Device Tokens
export const registerDeviceToken = async (data: {
  token: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
}) => {
  return apiClient.post('/api/v1/notifications/devices', data);
};

export const getDeviceTokens = async () => {
  return apiClient.get<{ tokens: string[] }>('/api/v1/notifications/devices');
};

export const unregisterDeviceToken = async (token: string) => {
  return apiClient.delete(`/api/v1/notifications/devices/${token}`);
};

// Preferences
export const getNotificationPreferences = async () => {
  return apiClient.get<NotificationPreference>('/api/v1/notifications/preferences');
};

export const updateNotificationPreferences = async (
  data: UpdateNotificationPreferenceRequest
) => {
  return apiClient.put<NotificationPreference>(
    '/api/v1/notifications/preferences',
    data
  );
};
