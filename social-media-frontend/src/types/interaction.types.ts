import { Profile } from './user.types';

export interface Like {
  id: string;
  user_id: string;
  post_id?: string;
  comment_id?: string;
  created_at: string;
  user?: Profile;
}

export interface LikesCount {
  count: number;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string;
  content: string;
  likes_count: number;
  replies_count: number;
  liked_by_user?: boolean;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export interface CreateCommentRequest {
  content: string;
  parent_id?: string;
}

export interface Share {
  id: string;
  post_id: string;
  user_id: string;
  comment?: string;
  created_at: string;
  user?: Profile;
}

export interface SharesCount {
  count: number;
}

export interface PaginatedCommentsResponse {
  items: Comment[];
  cursor?: string;
  has_more: boolean;
  total?: number;
}