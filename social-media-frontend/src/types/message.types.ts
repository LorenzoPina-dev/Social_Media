import { Profile } from './user.types';

export interface Conversation {
  id: string;
  participant: Profile;
  lastMessage: Message | null;
  unreadCount: number;
  updated_at: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
  sender?: Profile;
}

export interface SendMessageRequest {
  content: string;
}

export interface ConversationDetails {
  participant: Profile;
}
