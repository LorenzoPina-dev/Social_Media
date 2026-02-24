export interface Profile {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  website_url?: string;
  location?: string;
  verified: boolean;
  followers_count: number;
  following_count: number;
  posts_count: number;
  follower_count?: number;
  post_count?: number;
  is_following?: boolean;
  is_follower?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileRequest {
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  website_url?: string;
  location?: string;
}

export interface Follower {
  id: string;
  user_id: string;
  follower_id: string;
  created_at: string;
  user?: Profile;
}

export interface Following {
  id: string;
  user_id: string;
  following_id: string;
  created_at: string;
  user?: Profile;
}

export interface FollowStatus {
  isFollowing: boolean;
  isFollower: boolean;
  following_since?: string;
}

export interface UserStats {
  user_id: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  total_likes_received: number;
  total_shares_received: number;
  total_comments_received: number;
  account_age_days: number;
  last_active: string;
}

export interface GDPRExportData {
  user: Profile;
  posts: any[];
  comments: any[];
  likes: any[];
  followers: any[];
  following: any[];
  account_history: any[];
  export_date: string;
  expires_at: string;
}

export interface DataDeletionStatus {
  status: 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  requested_at?: string;
  scheduled_deletion?: string;
  can_cancel: boolean;
}


export interface UsersBatchRequest {
  ids: string[];
}

// Add to your existing types
export interface PrivacySettings {
  is_private: boolean;
  show_activity_status: boolean;
  allow_tagging: boolean;
  allow_mentions: boolean;
  allow_direct_messages: 'everyone' | 'followers' | 'none';
  blocked_users: string[];
  muted_users: string[];
  hide_likes_and_views: boolean;
  comment_filter: 'everyone' | 'followers' | 'none';
}
