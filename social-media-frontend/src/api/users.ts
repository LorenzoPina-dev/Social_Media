import { apiClient } from './client';
import {
  Profile,
  UpdateProfileRequest,
  Follower,
  Following,
  GDPRExportData,
  UserStats,
  FollowStatus,
  DataDeletionStatus,
} from '@/types/user.types';
import { CursorParams, PaginatedResponse } from '@/types/api.types';

// User Profile
export const getUserProfile = async (userId?: string) => {
  const url = userId ? `/api/v1/users/${userId}` : '/api/v1/users/me';
  return apiClient.get<Profile>(url);
};

export const updateProfile = async (userId: string, data: UpdateProfileRequest) => {
  return apiClient.put<Profile>(`/api/v1/users/${userId}`, data);
};

export const deleteUser = async (userId: string) => {
  return apiClient.delete(`/api/v1/users/${userId}`);
};

export const searchUsers = async (q: string, limit?: number) => {
  return apiClient.get<PaginatedResponse<Profile>>('/api/v1/users/search', {
    params: { q, limit },
  });
};

export const getUsersBatch = async (ids: string[]) => {
  return apiClient.post<Profile[]>('/api/v1/users/batch', { ids });
};

// Followers
export const followUser = async (userId: string) => {
  return apiClient.post(`/api/v1/users/${userId}/follow`);
};

export const unfollowUser = async (userId: string) => {
  return apiClient.delete(`/api/v1/users/${userId}/follow`);
};

export const getFollowers = async (userId: string, params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Follower>>(
    `/api/v1/users/${userId}/followers`,
    { params }
  );
};

export const getFollowing = async (userId: string, params?: CursorParams) => {
  return apiClient.get<PaginatedResponse<Following>>(
    `/api/v1/users/${userId}/following`,
    { params }
  );
};

export const checkFollow = async (userId: string, targetId: string) => {
  return apiClient.get<FollowStatus>(
    `/api/v1/users/${userId}/follows/${targetId}`
  );
};

export const getUserStats = async (userId: string) => {
  return apiClient.get<UserStats>(`/api/v1/users/${userId}/stats`);
};

// GDPR
export const exportGDPRData = async (userId: string) => {
  return apiClient.get<GDPRExportData>(`/api/v1/users/${userId}/export`);
};

export const requestAccountDeletion = async (userId: string) => {
  return apiClient.post(`/api/v1/users/${userId}/delete-request`);
};

export const cancelAccountDeletion = async (userId: string) => {
  return apiClient.post(`/api/v1/users/${userId}/cancel-deletion`);
};

export const getDataDeletionStatus = async (userId: string) => {
  return apiClient.get<DataDeletionStatus>(`/api/v1/users/${userId}/data-status`);
};