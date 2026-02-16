/**
 * Validation utilities
 */

import { config } from '../config';

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < config.PASSWORD.MIN_LENGTH) {
    errors.push(`Password must be at least ${config.PASSWORD.MIN_LENGTH} characters long`);
  }

  if (config.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (config.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (config.PASSWORD.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (config.PASSWORD.REQUIRE_SPECIAL && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username format
 */
export function validateUsername(username: string): boolean {
  // Username: 3-30 characters, alphanumeric, underscore, hyphen
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Sanitize input
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Validate MFA code format
 */
export function validateMFACode(code: string): boolean {
  // 6 digits or backup code format (XXXX-XXXX)
  const totpRegex = /^\d{6}$/;
  const backupCodeRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return totpRegex.test(code) || backupCodeRegex.test(code);
}
