import type { ApiEnvelope } from '@/types/contracts';

export interface CursorParams {
  cursor?: string;
  limit?: number;
}

export interface OffsetParams {
  offset?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data?: T[];
  items?: T[];
  total?: number;
  cursor?: string;
  offset?: number;
  limit?: number;
  has_more?: boolean;
  hasMore?: boolean;
  pagination?: {
    cursor?: string;
    has_more?: boolean;
    hasMore?: boolean;
    total?: number;
  };
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  path?: string;
}

export type ApiResponse<T = unknown> =
  | ApiEnvelope<T>
  | {
      data: T;
      status: number;
      message?: string;
      timestamp?: string;
    };
