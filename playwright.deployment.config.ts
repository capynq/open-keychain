import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /deployment\.spec\.ts/,
  timeout: 45_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'https://open-keychain.com',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'deployed-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'deployed-mobile', use: { ...devices['Pixel 5'] } },
  ],
});
