/**
 * TypeScript Type Definitions
 * Auth Service
 */

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  display_name?: string;
  avatar_url?: string;
  verified: boolean;
  mfa_enabled: boolean;
  mfa_secret?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION';
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginDto {
  username: string;
  password: string;
  mfa_code?: string;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface Session {
  id: string;
  user_id: string;
  refresh_token: string;
  device_info?: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
  created_at: Date;
  last_activity: Date;
}

export interface CreateSessionDto {
  user_id: string;
  refresh_token: string;
  device_info?: string;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
}

// ============================================================================
// TOKEN TYPES
// ============================================================================

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  verified: boolean;
  mfa_enabled: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
  iss: string;
}

// ============================================================================
// MFA TYPES
// ============================================================================

export interface MFASecret {
  id: string;
  user_id: string;
  secret: string;
  backup_codes: string[];
  created_at: Date;
  verified_at?: Date;
}

export interface MFASetupResponse {
  secret: string;
  qr_code: string;
  backup_codes: string[];
}

export interface VerifyMFADto {
  code: string;
}

// ============================================================================
// PASSWORD RESET TYPES
// ============================================================================

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

export interface RequestPasswordResetDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  new_password: string;
}

// ============================================================================
// OAUTH TYPES
// ============================================================================

export interface OAuthProfile {
  provider: 'google' | 'github';
  provider_id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

export interface OAuthAccount {
  id: string;
  user_id: string;
  provider: 'google' | 'github';
  provider_id: string;
  access_token?: string;
  refresh_token?: string;
  created_at: Date;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface AuthResponse {
  success: boolean;
  data?: TokenPair & {
    user: Omit<User, 'password_hash' | 'mfa_secret'>;
  };
  error?: string;
  code?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ============================================================================
// EVENT TYPES (for Kafka)
// ============================================================================

export interface UserAuthenticatedEvent {
  type: 'user_authenticated';
  userId: string;
  timestamp: Date;
  ip_address?: string;
  device_info?: string;
}

export interface UserRegisteredEvent {
  type: 'user_registered';
  userId: string;
  username: string;
  email: string;
  timestamp: Date;
}

export interface PasswordChangedEvent {
  type: 'password_changed';
  userId: string;
  timestamp: Date;
}

export interface MFAEnabledEvent {
  type: 'mfa_enabled';
  userId: string;
  timestamp: Date;
}

export interface SuspiciousLoginEvent {
  type: 'suspicious_login';
  userId: string;
  ip_address: string;
  reason: string;
  timestamp: Date;
}

export type AuthEvent =
  | UserAuthenticatedEvent
  | UserRegisteredEvent
  | PasswordChangedEvent
  | MFAEnabledEvent
  | SuspiciousLoginEvent;

// ============================================================================
// ERROR TYPES
// ============================================================================

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ValidationError extends AuthError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AuthError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AuthError {
  constructor(message: string = 'Not found') {
    super('NOT_FOUND', message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AuthError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends AuthError {
  constructor(message: string = 'Too many requests') {
    super('TOO_MANY_REQUESTS', message, 429);
    this.name = 'TooManyRequestsError';
  }
}
