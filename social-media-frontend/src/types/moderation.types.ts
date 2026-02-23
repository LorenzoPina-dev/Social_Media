export interface ReportRequest {
  entity_id: string;
  entity_type: 'POST' | 'COMMENT' | 'MEDIA';
  reason: 'USER_REPORT';
  content?: string;
  media_urls?: string[];
}

export interface ModerationCase {
  id: string;
  entity_id: string;
  entity_type: 'POST' | 'COMMENT' | 'MEDIA';
  reason: string;
  status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED';
  decision?: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  content?: string;
  media_urls?: string[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  reported_by: string;
  assigned_to?: string;
  reporter?: {
    id: string;
    username: string;
    display_name?: string;
  };
  assignee?: {
    id: string;
    username: string;
    display_name?: string;
  };
}

export interface AppealRequest {
  case_id: string;
  reason: string;
}

export interface Appeal {
  id: string;
  case_id: string;
  user_id: string;
  reason: string;
  status: 'PENDING' | 'GRANTED' | 'DENIED';
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
  case?: ModerationCase;
  user?: {
    id: string;
    username: string;
    display_name?: string;
  };
  resolver?: {
    id: string;
    username: string;
    display_name?: string;
  };
}

export interface ResolveCaseRequest {
  decision: 'APPROVED' | 'REJECTED' | 'ESCALATED';
  reason?: string;
}

export interface ResolveAppealRequest {
  status: 'GRANTED' | 'DENIED';
}

export interface ModerationStats {
  total_cases: number;
  pending_cases: number;
  in_review_cases: number;
  resolved_cases: number;
  average_resolution_time?: number;
  cases_by_type: {
    POST: number;
    COMMENT: number;
    MEDIA: number;
  };
  cases_by_reason: Record<string, number>;
}