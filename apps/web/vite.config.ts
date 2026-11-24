import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

/** Short commit of this build: Railway passes it in; locally, ask git. */
function buildSha(): string {
  const env = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA;
  if (env) return env.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

const API = process.env.API_ORIGIN ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __BUILD_SHA__: JSON.stringify(buildSha()) },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: false },
      '/collab': { target: API.replace(/^http/, 'ws'), ws: true },
    },
  },
  preview: {
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
