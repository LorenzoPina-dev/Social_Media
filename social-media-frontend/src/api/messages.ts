import { apiClient } from './client';
import { AxiosError } from 'axios';
import { Conversation, Message } from '@/types/message.types';
import { CursorParams } from '@/types/api.types';

const isMessagesUnavailable = (error: unknown): boolean => {
  const axiosError = error as AxiosError;
  const status = axiosError.response?.status;
  return axiosError.code === 'ERR_NETWORK' || status === 404 || status === 501;
};

export const getConversations = async () => {
  try {
    return await apiClient.get<Conversation[]>('/api/v1/messages/conversations');
  } catch (error) {
    if (isMessagesUnavailable(error)) {
      return {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
    }
    throw error;
  }
};

export const getConversationDetails = async (conversationId: string) => {
  return apiClient.get<{ participant: Conversation['participant'] }>(
    `/api/v1/messages/conversations/${conversationId}`
  );
};

export const getMessages = async (conversationId: string, params?: CursorParams) => {
  try {
    return await apiClient.get<Message[]>(`/api/v1/messages/${conversationId}`, { params });
  } catch (error) {
    if (isMessagesUnavailable(error)) {
      return {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
    }
    throw error;
  }
};

export const sendMessage = async (conversationId: string, content: string) => {
  return apiClient.post<Message>(`/api/v1/messages/${conversationId}`, { content });
};

export const markAsRead = async (conversationId: string, messageId: string) => {
  return apiClient.post(`/api/v1/messages/${conversationId}/read/${messageId}`);
};

export const deleteMessage = async (messageId: string) => {
  return apiClient.delete(`/api/v1/messages/${messageId}`);
};

export const startConversation = async (userId: string) => {
  return apiClient.post<Conversation>('/api/v1/messages/conversations', { userId });
};
