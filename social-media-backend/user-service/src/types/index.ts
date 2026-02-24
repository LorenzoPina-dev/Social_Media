/**
 * TypeScript Type Definitions
 * User Service
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiFailure {
  success: false;
  error: string;
  code: string;
  details?: Array<{ field?: string; message: string }>;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export interface CursorPage<T> {
  items: T[];
  cursor?: string;
  has_more: boolean;
}

export interface OffsetPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface UserDto {
  id: string;
  username: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  verified?: boolean;
  follower_count?: number;
  following_count?: number;
  created_at?: string | Date;
  updated_at?: string | Date;
}

export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  verified: boolean;
  follower_count: number;
  following_count: number;
  status: 'ACTIVE' | 'PENDING_DELETION' | 'DELETED';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface CreateUserDto {
  id: string;
  username: string;
  email: string;
  display_name?: string;  // opzionale: può non essere presente all'evento Kafka
  bio?: string;
  avatar_url?: string;
}

export interface UpdateUserDto {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}

export interface PrivacySettings {
  user_id: string;
  is_private: boolean;
  show_activity_status: boolean;
  allow_tagging: boolean;
  allow_mentions: boolean;
  allow_direct_messages: 'everyone' | 'followers' | 'none';
  blocked_users: string[];
  muted_users: string[];
  hide_likes_and_views: boolean;
  comment_filter: 'everyone' | 'followers' | 'none';
  created_at: Date;
  updated_at: Date;
}

export interface UpdatePrivacySettingsDto {
  is_private?: boolean;
  show_activity_status?: boolean;
  allow_tagging?: boolean;
  allow_mentions?: boolean;
  allow_direct_messages?: 'everyone' | 'followers' | 'none';
  blocked_users?: string[];
  muted_users?: string[];
  hide_likes_and_views?: boolean;
  comment_filter?: 'everyone' | 'followers' | 'none';
}

export interface Follower {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: Date;
}

export interface UserProfile extends User {
  is_following?: boolean;
  followers?: User[];
  following?: User[];
}
// Canonical pagination types are exported from @social-media/shared.

export interface SearchFilters {
  verified?: boolean;
  minFollowers?: number;
  maxFollowers?: number;
}

export interface GDPRExportData {
  user: User;
  followers: User[];
  following: User[];
  exportDate: Date;
  format: 'json';
}
