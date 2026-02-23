import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { refreshToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshTokenValue = localStorage.getItem('refreshToken');
        if (!refreshTokenValue) {
          throw new Error('No refresh token');
        }

        const response = await refreshToken({ refreshToken: refreshTokenValue });
        
        localStorage.setItem('accessToken', response.data.access_token);
        localStorage.setItem('refreshToken', response.data.refresh_token);
        
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
        originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);