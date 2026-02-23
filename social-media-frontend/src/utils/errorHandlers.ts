import { AxiosError } from 'axios';
import toast from 'react-hot-toast';

export interface AppError {
  message: string;
  code: string;
  status: number;
}

export const parseApiError = (error: unknown): AppError => {
  if (error instanceof AxiosError) {
    const status = error.response?.status || 500;
    const data = error.response?.data;
    
    return {
      message: data?.error || error.message || 'Errore sconosciuto',
      code: data?.code || `ERR_${status}`,
      status,
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'ERR_UNKNOWN',
      status: 500,
    };
  }
  
  return {
    message: 'Errore sconosciuto',
    code: 'ERR_UNKNOWN',
    status: 500,
  };
};

export const handleApiError = (error: unknown, fallbackMessage?: string) => {
  const appError = parseApiError(error);
  
  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('API Error:', appError);
  }
  
  // Show toast notification
  toast.error(appError.message || fallbackMessage || 'Si è verificato un errore');
  
  return appError;
};

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof AxiosError) {
    return !error.response && !!error.request;
  }
  return false;
};

export const isAuthError = (error: unknown): boolean => {
  if (error instanceof AxiosError) {
    return error.response?.status === 401 || error.response?.status === 403;
  }
  return false;
};