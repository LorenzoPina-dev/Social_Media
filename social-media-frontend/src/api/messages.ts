import { apiClient } from './client';
import { AxiosError } from 'axios';
import { CursorParams } from '@/types/api.types';
import { Conversation, ConversationDetails, Message } from '@/types/message.types';
import { unwrapData, unwrapItems } from './envelope';

const isMessagesUnavailable = (error: unknown): boolean => {
  const axiosError = error as AxiosError;
  const status = axiosError.response?.status;
  return axiosError.code === 'ERR_NETWORK' || status === 404 || status === 501;
};

export const getConversations = async (): Promise<Conversation[]> => {
  try {
    const response = await apiClient.get('/api/v1/messages/conversations');
    return unwrapItems<Conversation>(response.data);
  } catch (error) {
    if (isMessagesUnavailable(error)) {
      return [];
    }
    throw error;
  }
};

export const getConversationDetails = async (
  conversationId: string
): Promise<ConversationDetails> => {
  const response = await apiClient.get(`/api/v1/messages/conversations/${conversationId}`);
  return unwrapData<ConversationDetails>(response.data);
};

export const getMessages = async (
  conversationId: string,
  params?: CursorParams
): Promise<Message[]> => {
  try {
    const response = await apiClient.get(`/api/v1/messages/${conversationId}`, { params });
    return unwrapItems<Message>(response.data);
  } catch (error) {
    if (isMessagesUnavailable(error)) {
      return [];
    }
    throw error;
  }
};

export const sendMessage = async (
  conversationId: string,
  content: string
): Promise<Message> => {
  const response = await apiClient.post(`/api/v1/messages/${conversationId}`, { content });
  return unwrapData<Message>(response.data);
};

export const markAsRead = async (conversationId: string, messageId: string): Promise<void> => {
  await apiClient.post(`/api/v1/messages/${conversationId}/read/${messageId}`);
};

export const deleteMessage = async (messageId: string): Promise<void> => {
  await apiClient.delete(`/api/v1/messages/${messageId}`);
};

export const startConversation = async (
  userId: string
): Promise<{ conversation_id: string }> => {
  const response = await apiClient.post('/api/v1/messages/conversations', { userId });
  return unwrapData<{ conversation_id: string }>(response.data);
};
