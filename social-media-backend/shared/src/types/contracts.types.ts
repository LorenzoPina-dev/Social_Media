/**
 * Canonical API contracts shared by frontend and backend.
 * This file is the single source of truth for envelope, pagination and core DTOs.
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

export interface TokenPairDto {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface LoginResultDto {
  user: UserDto;
  tokens: TokenPairDto;
  mfa_required?: boolean;
}

export interface PostDto {
  id: string;
  user_id: string;
  content: string;
  media_urls?: string[] | null;
  media_types?: string[] | null;
  visibility?: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  created_at: string | Date;
  updated_at?: string | Date;
}

export interface NotificationDto {
  id: string;
  recipient_id: string;
  type: 'LIKE' | 'COMMENT' | 'FOLLOW' | 'MENTION' | 'SYSTEM';
  title: string;
  body: string;
  read: boolean;
  created_at: string | Date;
}

/**
 * Optional typed endpoint map.
 * Use this to statically type API client wrappers.
 */
export interface EndpointContractMap {
  '/api/v1/auth/login': {
    request: { username: string; password: string; mfa_code?: string };
    response: ApiEnvelope<LoginResultDto>;
  };
  '/api/v1/auth/register': {
    request: { username: string; email: string; password: string; display_name?: string };
    response: ApiEnvelope<{ user: UserDto; tokens: TokenPairDto }>;
  };
  '/api/v1/users/me': {
    request: never;
    response: ApiEnvelope<UserDto>;
  };
  '/api/v1/posts/trending/hashtags': {
    request: { limit?: number };
    response: ApiEnvelope<Array<{ tag: string; post_count: number }>>;
  };
}
