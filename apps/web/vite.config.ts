import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API = process.env.API_ORIGIN ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: false },
      '/collab': { target: API.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    target: 'es2023',
    chunkSizeWarningLimit: 5000,
  },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
  },
});
