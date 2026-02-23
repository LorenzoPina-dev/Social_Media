/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_GATEWAY_URL: string;
  readonly VITE_SOCKET_URL: string;
  readonly VITE_CDN_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_MAX_FILE_SIZE: string;
  readonly VITE_MAX_FILES_PER_POST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}