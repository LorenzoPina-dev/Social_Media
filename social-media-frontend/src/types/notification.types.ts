export interface Notification {
  id: string;
  type: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'MENTION' | 'SYSTEM';
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  actor?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface NotificationPreference {
  likes_push: boolean;
  likes_email: boolean;
  comments_push: boolean;
  comments_email: boolean;
  follows_push: boolean;
  follows_email: boolean;
  mentions_push: boolean;
  mentions_email: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

export interface UpdateNotificationPreferenceRequest {
  likes_push?: boolean;
  likes_email?: boolean;
  comments_push?: boolean;
  comments_email?: boolean;
  follows_push?: boolean;
  follows_email?: boolean;
  mentions_push?: boolean;
  mentions_email?: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

export interface UnreadCountResponse {
  count: number;
}

export interface DeviceTokenRequest {
  token: string;
  platform: 'IOS' | 'ANDROID' | 'WEB';
}

export interface DeviceTokensResponse {
  tokens: string[];
}