// auth.ts
import { apiClient } from './client';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  MFASetupResponse,
  MFAVerifyRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  MFAStatusResponse,
} from '@/types/auth.types';

export const login = async (data: LoginRequest) => {
  const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', data);
  
  // Dopo il login, impostiamo l'header Authorization
  const accessToken = response.data.data.tokens.access_token;
  if (accessToken) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    console.log('Auth header impostato dopo login:', apiClient.defaults.headers.common['Authorization']);
  }
  
  return response;
};

export const register = async (data: RegisterRequest) => {
  return apiClient.post('/api/v1/auth/register', data);
};

export const logout = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  // Rimuovi l'header Authorization prima di fare logout
  delete apiClient.defaults.headers.common['Authorization'];
  return apiClient.post('/api/v1/auth/logout', { refresh_token: refreshToken });
};

export const logoutAll = async () => {
  delete apiClient.defaults.headers.common['Authorization'];
  return apiClient.post('/api/v1/auth/logout-all');
};

export const refreshToken = async (data: RefreshTokenRequest) => {
  return apiClient.post<RefreshTokenResponse>('/api/v1/auth/refresh', {
    refresh_token: data.refreshToken,
  });
};

// MFA Endpoints
export const setupMFA = async () => {
  return apiClient.post<MFASetupResponse>('/api/v1/mfa/setup');
};

export const verifyMFA = async (data: MFAVerifyRequest) => {
  return apiClient.post('/api/v1/mfa/verify', { code: data.code });
};

export const disableMFA = async (code: string) => {
  return apiClient.post('/api/v1/mfa/disable', { code });
};

export const regenerateMFACodes = async (code: string) => {
  return apiClient.post('/api/v1/mfa/regenerate-codes', { code });
};

export const getMFAStatus = async () => {
  return apiClient.get<MFAStatusResponse>('/api/v1/mfa/status');
};

// Password Management
export const forgotPassword = async (data: ForgotPasswordRequest) => {
  return apiClient.post('/api/v1/auth/forgot-password', data);
};

export const resetPassword = async (data: ResetPasswordRequest) => {
  return apiClient.post('/api/v1/auth/reset-password', data);
};
