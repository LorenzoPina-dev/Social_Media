import { apiClient } from './client';
import { jwtDecode } from 'jwt-decode';
import {
  Profile,
  UpdateProfileRequest,
  Follower,
  Following,
  GDPRExportData,
  UserStats,
  FollowStatus,
  DataDeletionStatus,
  PrivacySettings,
} from '@/types/user.types';
import { CursorParams, PaginatedResponse } from '@/types/api.types';

interface JwtPayload {
  userId?: string;
  sub?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const decodeCurrentUserId = (): string | null => {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    return decoded.userId || decoded.sub || null;
  } catch {
    return null;
  }
};

const requireCurrentUserId = (): string => {
  const userId = decodeCurrentUserId();
  if (!userId) throw new Error('Current user id not found');
  return userId;
};

const extractUsers = (payload: any): Profile[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const resolveUserId = async (identifier?: string): Promise<string> => {
  if (!identifier) return requireCurrentUserId();
  if (UUID_REGEX.test(identifier)) return identifier;

  const searchResponse = await apiClient.get('/api/v1/users/search', {
    params: { q: identifier, limit: 20 },
  });
  const candidates = extractUsers(searchResponse.data);
  const exact =
    candidates.find((u) => u.username?.toLowerCase() === identifier.toLowerCase()) ||
    candidates[0];

  if (!exact?.id) {
    throw new Error(`User not found for identifier: ${identifier}`);
  }

  return exact.id;
};

// User Profile
export const getUserProfile = async (identifier?: string) => {
  if (!identifier) {
    return apiClient.get('/api/v1/users/me');
  }

  const userId = await resolveUserId(identifier);
  return apiClient.get(`/api/v1/users/${userId}`);
};

export const updateProfile = async (
  userIdOrData: string | UpdateProfileRequest,
  maybeData?: UpdateProfileRequest
) => {
  const userId =
    typeof userIdOrData === 'string' ? userIdOrData : requireCurrentUserId();
  const data = typeof userIdOrData === 'string' ? maybeData : userIdOrData;
  return apiClient.put<Profile>(`/api/v1/users/${userId}`, data);
};

export const deleteUser = async (userId: string) => {
  return apiClient.delete(`/api/v1/users/${userId}`);
};

export const deleteAccount = async (userId?: string) => {
  const resolvedUserId = userId || requireCurrentUserId();
  return deleteUser(resolvedUserId);
};

export const searchUsers = async (q: string, limit?: number) => {
  return apiClient.get('/api/v1/users/search', {
    params: { q, limit },
  });
};

export const getUsersBatch = async (ids: string[]) => {
  return apiClient.post<Profile[]>('/api/v1/users/batch', { ids });
};

// Backend non espone /users/suggested: fallback su search
export const getSuggestedUsers = async (params?: { limit?: number; q?: string }) => {
  return apiClient.get('/api/v1/users/search', {
    params: { q: params?.q || 'a', limit: params?.limit || 10 },
  });
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

// Privacy Settings
export const getPrivacySettings = async (userId?: string) => {
  // Backend user-service currently does not expose /users/:id/privacy
  return Promise.resolve({
    data: {
      is_private: false,
      hide_activity_status: false,
      allow_tagging: true,
      allow_mentions: true,
      allow_direct_messages: 'everyone',
      who_can_comment: 'everyone',
      who_can_see_likes: 'everyone',
    },
  } as any);
};

export const updatePrivacySettings = async (settingsOrUserId: string | PrivacySettings, maybeSettings?: PrivacySettings) => {
  const settings =
    typeof settingsOrUserId === 'string' ? maybeSettings : settingsOrUserId;
  return Promise.resolve({ data: settings } as any);
};

// GDPR
export const exportGDPRData = async (userId?: string) => {
  const resolvedUserId = userId || requireCurrentUserId();
  return apiClient.get<GDPRExportData>(`/api/v1/users/${resolvedUserId}/export`);
};

export const requestAccountDeletion = async (userId?: string) => {
  const resolvedUserId = userId || requireCurrentUserId();
  return apiClient.post(`/api/v1/users/${resolvedUserId}/delete-request`);
};

export const cancelAccountDeletion = async (userId?: string) => {
  const resolvedUserId = userId || requireCurrentUserId();
  return apiClient.post(`/api/v1/users/${resolvedUserId}/cancel-deletion`);
};

export const getDataDeletionStatus = async (userId?: string) => {
  const resolvedUserId = userId || requireCurrentUserId();
  return apiClient.get<DataDeletionStatus>(`/api/v1/users/${resolvedUserId}/data-status`);
};

export const getCurrentUser = async () => {
  return apiClient.get('/api/v1/users/me');
};
