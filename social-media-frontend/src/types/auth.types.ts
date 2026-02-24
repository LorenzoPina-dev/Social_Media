import type { ApiEnvelope, LoginResultDto, TokenPairDto, UserDto } from '@/types/contracts';

export interface LoginRequest {
  username: string;
  password?: string;
  mfa_code?: string;
}

export type TokenPair = TokenPairDto;

export type LoginResponseData = LoginResultDto;

export type LoginResponse = ApiEnvelope<LoginResponseData>;

export interface RegisterRequest {
  username: string;
  email: string;
  password?: string;
  display_name?: string;
}

export interface RegisterResponse {
  id: string;
  username: string;
  email: string;
  display_name?: string;
  requires_email_verification: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export type RefreshTokenResponse = ApiEnvelope<TokenPair>;

export interface MFASetupResponse {
  secret: string;
  qr_code: string;
  backup_codes: string[];
}

export interface MFAVerifyRequest {
  code: string;
}

export interface MFAStatusResponse {
  enabled: boolean;
  verified: boolean;
  backup_codes_count?: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password?: string;
  newPassword?: string;
  confirm_password?: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface User extends UserDto {
  id: string;
  username: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  verified: boolean;
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
}

