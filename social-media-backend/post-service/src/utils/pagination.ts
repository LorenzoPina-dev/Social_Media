/**
 * Cursor-based Pagination Utilities
 */

export function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(JSON.stringify({ id, createdAt: createdAt.toISOString() })).toString('base64');
}

export function decodeCursor(cursor: string): { id: string; createdAt: Date } {
  const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  return { id: decoded.id, createdAt: new Date(decoded.createdAt) };
}
