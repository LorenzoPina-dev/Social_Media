export const APP_NAME = 'SocialApp';
export const APP_VERSION = '1.0.0';

export const API = {
  BASE_URL: import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000',
  SOCKET_URL: import.meta.env.VITE_SOCKET_URL || 'http://localhost:3007',
  CDN_URL: import.meta.env.VITE_CDN_URL || 'http://localhost:9000',
  TIMEOUT: 10000,
};

export const PAGINATION = {
  DEFAULT_LIMIT: 10,
  FEED_LIMIT: 10,
  COMMENTS_LIMIT: 20,
  NOTIFICATIONS_LIMIT: 20,
  SEARCH_LIMIT: 20,
};

export const FILE = {
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_FILES_PER_POST: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
};

export const CACHE = {
  USER_TTL: 5 * 60 * 1000, // 5 minutes
  POST_TTL: 5 * 60 * 1000, // 5 minutes
  FEED_TTL: 1 * 60 * 1000, // 1 minute
  SEARCH_TTL: 5 * 60 * 1000, // 5 minutes
};

export const ROUTES = {
  HOME: '/',
  EXPLORE: '/explore',
  NOTIFICATIONS: '/notifications',
  MESSAGES: '/messages',
  PROFILE: '/profile/:username',
  POST: '/p/:postId',
  SEARCH: '/search',
  SETTINGS: '/settings/:tab?',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password/:token',
  MFA: '/mfa',
};

export const SOCIAL = {
  MAX_POST_LENGTH: 2000,
  MAX_COMMENT_LENGTH: 1000,
  MAX_BIO_LENGTH: 500,
  MAX_DISPLAY_NAME_LENGTH: 100,
  MAX_USERNAME_LENGTH: 30,
  MIN_USERNAME_LENGTH: 3,
  MAX_HASHTAGS_PER_POST: 30,
  MAX_COMMENT_DEPTH: 3,
};

export const ERROR_MESSAGES = {
  NETWORK: 'Errore di connessione. Controlla la tua rete.',
  UNAUTHORIZED: 'Sessione scaduta. Effettua di nuovo il login.',
  FORBIDDEN: 'Non hai permessi per questa operazione.',
  NOT_FOUND: 'Risorsa non trovata.',
  SERVER_ERROR: 'Errore del server. Riprova più tardi.',
  VALIDATION: 'Dati non validi. Controlla i campi inseriti.',
  DEFAULT: 'Si è verificato un errore. Riprova.',
};