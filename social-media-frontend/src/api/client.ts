// client.ts
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { refreshToken } from './auth';
import { unwrapData } from './envelope';

const rawApiBaseUrl = import.meta.env.VITE_API_GATEWAY_URL || '';
const API_BASE_URL =
  rawApiBaseUrl === 'http://localhost' ? 'http://127.0.0.1' : rawApiBaseUrl;

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Variabile per prevenire loop di refresh
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Funzione per impostare l'header Authorization
const setAuthHeader = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Request with token:', config.url, config.headers.Authorization); // Debug
    } else {
      console.log('Request without token:', config.url);
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log('Response success:', response.config.url, response.status);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    console.log('Response error:', error.response?.status, error.config?.url);

    // Se non è un errore 401 o se è già stato ritentato
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Se è in corso un refresh, accoda la richiesta
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        })
        .catch(err => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshTokenValue = localStorage.getItem('refreshToken');
      if (!refreshTokenValue) {
        throw new Error('No refresh token');
      }

      console.log('Refreshing token...');
      const response = await refreshToken({ refreshToken: refreshTokenValue });
      const tokenData = unwrapData<{ access_token: string; refresh_token: string }>(response.data);
      
      const newAccessToken = tokenData.access_token;
      const newRefreshToken = tokenData.refresh_token;
      
      console.log('New tokens received');
      
      // Salva i nuovi token
      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem('refreshToken', newRefreshToken);
      
      // Imposta l'header Authorization con il nuovo token
      setAuthHeader(newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      
      processQueue(null, newAccessToken);
      
      return apiClient(originalRequest);
    } catch (refreshError) {
      console.error('Refresh failed:', refreshError);
      processQueue(refreshError, null);
      
      // Pulisci i token
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setAuthHeader(null);
      
      // Reindirizza al login solo se non siamo già sulla pagina di login
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
