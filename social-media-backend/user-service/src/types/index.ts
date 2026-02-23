/**
 * TypeScript Type Definitions
 * User Service
 */

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

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
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
