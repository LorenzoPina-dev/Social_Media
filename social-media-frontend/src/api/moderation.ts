import { apiClient } from './client';
import { CursorParams, PaginatedResponse } from '@/types/api.types';

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
  entity_type: string;
  reason: string;
  status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED';
  created_at: string;
  updated_at: string;
  reported_by: string;
  assigned_to?: string;
  decision?: 'APPROVED' | 'REJECTED' | 'ESCALATED';
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
}

// Reports & Cases
export const createReport = async (data: ReportRequest) => {
  return apiClient.post('/api/v1/moderation/report', data);
};

export const getModerationCase = async (id: string) => {
  return apiClient.get<ModerationCase>(`/api/v1/moderation/cases/${id}`);
};

export const getCasesByEntity = async (entityId: string, entityType?: string) => {
  return apiClient.get<ModerationCase[]>(`/api/v1/moderation/cases/entity/${entityId}`, {
    params: { entity_type: entityType },
  });
};

export const getCasesByStatus = async (
  status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED',
  params?: CursorParams
) => {
  return apiClient.get<PaginatedResponse<ModerationCase>>(
    `/api/v1/moderation/cases/status/${status}`,
    { params }
  );
};

export const resolveCase = async (
  id: string,
  data: {
    decision: 'APPROVED' | 'REJECTED' | 'ESCALATED';
    reason?: string;
  }
) => {
  return apiClient.post(`/api/v1/moderation/cases/${id}/resolve`, data);
};

export const assignCase = async (id: string) => {
  return apiClient.post(`/api/v1/moderation/cases/${id}/assign`);
};

// Appeals
export const createAppeal = async (data: AppealRequest) => {
  return apiClient.post('/api/v1/moderation/appeals', data);
};

export const getMyAppeals = async (params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Appeal>>('/api/v1/moderation/appeals/my', {
    params,
  });
};

export const getAppeal = async (id: string) => {
  return apiClient.get<Appeal>(`/api/v1/moderation/appeals/${id}`);
};

export const getAllAppeals = async (params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Appeal>>('/api/v1/moderation/appeals', {
    params,
  });
};

export const resolveAppeal = async (
  id: string,
  data: { status: 'GRANTED' | 'DENIED' }
) => {
  return apiClient.post(`/api/v1/moderation/appeals/${id}/resolve`, data);
};

// Review Queue
export const getReviewQueue = async (params?: {
  status?: 'PENDING' | 'IN_REVIEW' | 'RESOLVED';
  limit?: number;
  offset?: number;
}) => {
  return apiClient.get<PaginatedResponse<ModerationCase>>('/api/v1/moderation/review/queue', {
    params,
  });
};

export const getReviewCase = async (id: string) => {
  return apiClient.get<ModerationCase>(`/api/v1/moderation/review/cases/${id}`);
};

export const getModerationStats = async () => {
  return apiClient.get('/api/v1/moderation/review/stats');
};