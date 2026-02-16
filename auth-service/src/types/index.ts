/**
 * TypeScript Type Definitions
 * Auth Service
 */

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash?: string;
  display_name: string;
  avatar_url?: string;
  verified: boolean;
  status: 'ACTIVE' | 'PENDING_DELETION' | 'DELETED' | 'SUSPENDED';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface Session {
  id: string;
  user_id: string;
  refresh_token: string;
  device_info: DeviceInfo;
  ip_address: string;
  user_agent: string;
  last_activity: Date;
  expires_at: Date;
  created_at: Date;
}

export interface DeviceInfo {
  device_id: string;
  device_name: string;
  device_type: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  os: string;
  browser: string;
}

export interface MFASecret {
  id: string;
  user_id: string;
  secret: string;
  backup_codes: string[];
  enabled: boolean;
  verified: boolean;
  created_at: Date;
}

export interface RegisterDto {
  username: string;
  email: string;
  password: string;
  display_name: string;
}

export interface LoginDto {
  username: string;
  password: string;
  deviceInfo?: DeviceInfo;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface MFASetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: Omit<User, 'password_hash'>;
    tokens: TokenPair;
    mfaRequired?: boolean;
  };
}

export interface JWTPayload {
  sub: string; // user id
  username: string;
  email: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface OAuth2Profile {
  provider: 'google' | 'apple' | 'github' | 'facebook';
  providerId: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  verified: boolean;
}
