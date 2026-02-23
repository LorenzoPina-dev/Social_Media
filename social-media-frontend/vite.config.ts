import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_GATEWAY_URL || 'http://localhost',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/socket.io': {
        target: process.env.VITE_SOCKET_URL || 'http://localhost:3007',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['date-fns', 'react-dropzone', 'qrcode.react', 'emoji-picker-react'],
          forms: ['react-hook-form', 'zod'],
        },
      },
    },
  },
});