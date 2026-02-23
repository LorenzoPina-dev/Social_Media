import { apiClient } from './client';
import { Conversation, Message } from '@/types/message.types';
import { CursorParams, PaginatedResponse } from '@/types/api.types';

export const getConversations = async () => {
  return apiClient.get<Conversation[]>('/api/v1/messages/conversations');
};

export const getConversationDetails = async (conversationId: string) => {
  return apiClient.get<{ participant: Conversation['participant'] }>(
    `/api/v1/messages/conversations/${conversationId}`
  );
};

export const getMessages = async (conversationId: string, params?: CursorParams) => {
  return apiClient.get<Message[]>(`/api/v1/messages/${conversationId}`, { params });
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