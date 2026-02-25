/**
 * TypeScript Type Definitions
 * User Service
 */

export type {
  ApiEnvelope,
  ApiFailure,
  ApiSuccess,
  CursorPage,
  OffsetPage,
  UserDto,
} from '@social-media/shared';

export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  website_url?: string;
  location?: string;
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
  // Optional: can be missing in auth kafka event
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  website_url?: string;
  location?: string;
}

export interface UpdateUserDto {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  website_url?: string;
  location?: string;
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



