import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 5174;
const API_PORT = 3101;
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://postgres@localhost:5432/tidepool_e2e';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 1400, height: 850 },
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    // Use a preinstalled Chromium when the bundled one isn't available (e.g. sandboxes).
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  webServer: [
    {
      command: 'node --experimental-strip-types src/index.ts',
      cwd: 'apps/server',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        DATABASE_URL,
        BETTER_AUTH_URL: `http://localhost:${WEB_PORT}`,
        BETTER_AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-1234',
        DEV_LOGIN: 'true',
        ALLOWED_GOOGLE_DOMAIN: 'example.com',
      },
    },
    {
      // Test the production bundle (vite preview reuses the dev proxy config).
      command: `pnpm exec vite build && pnpm exec vite preview --port ${WEB_PORT} --strictPort`,
      cwd: 'apps/web',
      url: `http://localhost:${WEB_PORT}/play`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: { API_ORIGIN: `http://localhost:${API_PORT}` },
    },
  ],
});
