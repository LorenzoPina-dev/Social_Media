import { ApiEnvelope, CursorPage } from '@/types/contracts';

type AnyObject = Record<string, unknown>;

function isObject(value: unknown): value is AnyObject {
  return typeof value === 'object' && value !== null;
}

function hasSuccessEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return isObject(value) && 'success' in value;
}

export function unwrapData<T>(payload: unknown): T {
  if (hasSuccessEnvelope<T>(payload)) {
    if (payload.success) {
      return payload.data as T;
    }
    throw new Error(payload.error || payload.code || 'API error');
  }

  if (isObject(payload) && 'data' in payload) {
    return payload.data as T;
  }

  return payload as T;
}

export function unwrapItems<T>(payload: unknown): T[] {
  const data = unwrapData<unknown>(payload);

  if (Array.isArray(data)) {
    return data as T[];
  }

  if (isObject(data) && Array.isArray((data as AnyObject).items)) {
    return (data as AnyObject).items as T[];
  }

  if (isObject(payload) && Array.isArray((payload as AnyObject).items)) {
    return (payload as AnyObject).items as T[];
  }

  return [];
}

export function unwrapCursorPage<T>(payload: unknown): CursorPage<T> {
  const data = unwrapData<unknown>(payload);

  if (isObject(data) && Array.isArray((data as AnyObject).items)) {
    return data as unknown as CursorPage<T>;
  }

  if (isObject(payload)) {
    const root = payload as AnyObject;
    if (Array.isArray(root.data)) {
      return {
        items: root.data as T[],
        cursor: typeof root.cursor === 'string' ? root.cursor : undefined,
        has_more: Boolean(root.hasMore ?? root.has_more ?? root.cursor),
      };
    }
  }

  return { items: [], has_more: false };
}
