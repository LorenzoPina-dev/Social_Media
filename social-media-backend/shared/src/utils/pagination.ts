/**
 * Cursor-based Pagination Helpers
 * Encode/decode opaque cursors for keyset pagination.
 */

export interface CursorData {
  id: string;
  created_at: string;
}

/**
 * Encode cursor data to a Base64 opaque string.
 */
export function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decode an opaque cursor string back to structured data.
 * Returns `null` if the cursor is invalid.
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const data = JSON.parse(json) as CursorData;
    if (typeof data.id === 'string' && typeof data.created_at === 'string') {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sanitise limit parameter — clamp between 1 and maxLimit.
 */
export function sanitiseLimit(raw: unknown, defaultLimit = 20, maxLimit = 100): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (Number.isNaN(n) || n < 1) return defaultLimit;
  return Math.min(n, maxLimit);
}
