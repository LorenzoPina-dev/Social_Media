import { Response } from 'express';
import { ApiEnvelope, ApiFailure, ApiSuccess } from '../types/contracts.types';

export function ok<T>(res: Response, data: T, message?: string): Response<ApiSuccess<T>> {
  return res.json({ success: true, data, ...(message ? { message } : {}) });
}

export function created<T>(res: Response, data: T, message?: string): Response<ApiSuccess<T>> {
  return res.status(201).json({ success: true, data, ...(message ? { message } : {}) });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function fail(
  res: Response,
  status: number,
  code: string,
  error: string,
  details?: ApiFailure['details']
): Response<ApiFailure> {
  return res.status(status).json({ success: false, code, error, ...(details ? { details } : {}) });
}

export type { ApiEnvelope };
