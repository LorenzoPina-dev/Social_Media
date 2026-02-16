/**
 * Validator Utilities
 * Helper functions for validation
 */

import Joi from 'joi';

/**
 * Validate UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate email
 */
export function isValidEmail(email: string): boolean {
  const emailSchema = Joi.string().email();
  const { error } = emailSchema.validate(email);
  return !error;
}

/**
 * Validate username
 */
export function isValidUsername(username: string): boolean {
  // Username: 3-30 chars, alphanumeric, underscores, hyphens
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Validate URL
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize user input
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '');
}

/**
 * Validate display name
 */
export function isValidDisplayName(name: string): boolean {
  return name.length >= 1 && name.length <= 50;
}

/**
 * Validate bio
 */
export function isValidBio(bio: string): boolean {
  return bio.length <= 500;
}

/**
 * Pagination helpers
 */
export function validatePagination(params: {
  page?: number;
  pageSize?: number;
}): { page: number; pageSize: number } {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  return { page, pageSize };
}

/**
 * Calculate offset from page
 */
export function calculateOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/**
 * Validate search query
 */
export function isValidSearchQuery(query: string): boolean {
  return query.length >= 1 && query.length <= 100;
}

/**
 * Clean search query
 */
export function cleanSearchQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/gi, '');
}

/**
 * Check if string contains profanity (basic)
 */
export function containsProfanity(text: string): boolean {
  const profanityList = ['spam', 'scam']; // Add more as needed
  const lowerText = text.toLowerCase();
  return profanityList.some(word => lowerText.includes(word));
}

/**
 * Validate file size
 */
export function isValidFileSize(size: number, maxSize: number = 5 * 1024 * 1024): boolean {
  return size > 0 && size <= maxSize;
}

/**
 * Validate image URL
 */
export function isValidImageURL(url: string): boolean {
  if (!isValidURL(url)) return false;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  return imageExtensions.some(ext => url.toLowerCase().endsWith(ext));
}

/**
 * Rate limit key generator
 */
export function generateRateLimitKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`;
}

export default {
  isValidUUID,
  isValidEmail,
  isValidUsername,
  isValidURL,
  sanitizeString,
  isValidDisplayName,
  isValidBio,
  validatePagination,
  calculateOffset,
  isValidSearchQuery,
  cleanSearchQuery,
  containsProfanity,
  isValidFileSize,
  isValidImageURL,
  generateRateLimitKey,
};
