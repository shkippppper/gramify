import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/tidepool_test',
      BETTER_AUTH_URL: 'http://localhost:5173',
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
      DEV_LOGIN: 'true',
      ALLOWED_GOOGLE_DOMAIN: 'example.com',
    },
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
