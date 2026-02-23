export interface CursorParams {
  cursor?: string;
  limit?: number;
}

export interface OffsetParams {
  offset?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total?: number;
  cursor?: string;
  offset?: number;
  limit?: number;
  has_more: boolean;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  path?: string;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  message?: string;
  timestamp: string;
}