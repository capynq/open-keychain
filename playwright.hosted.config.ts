import { randomBytes } from 'node:crypto';

import { defineConfig } from '@playwright/test';

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('E2E_DATABASE_URL is required for hosted E2E tests.');
}

const parsedDatabaseUrl = new URL(databaseUrl);
if (!['127.0.0.1', 'localhost', '::1'].includes(parsedDatabaseUrl.hostname)) {
  throw new Error('Hosted E2E tests only accept a local E2E_DATABASE_URL.');
}

const apiUrl = 'http://127.0.0.1:3100';
const webUrl = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './e2e',
  testMatch: /hosted-.*\.spec\.ts/,
  timeout: 45_000,
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: webUrl,
    browserName: 'chromium',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm server:start',
      url: `${apiUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        APP_URL: webUrl,
        BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
        DATABASE_URL: databaseUrl,
        HOST: '127.0.0.1',
        PORT: '3100',
        VITE_POSTHOG_KEY: '',
      },
    },
    {
      command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4173',
      url: webUrl,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: '',
        VITE_HOSTED_MODE: 'true',
        VITE_POSTHOG_KEY: '',
      },
    },
  ],
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 900 } } }],
});
