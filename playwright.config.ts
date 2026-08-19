import { defineConfig } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const useExistingBuild = process.env.PLAYWRIGHT_USE_EXISTING_BUILD === 'true';

export default defineConfig({
  testDir: './e2e',
  testIgnore: /(deployment|capture)\.spec\.ts/,
  timeout: 30_000,
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4173',
    browserName: 'chromium',
    colorScheme: 'light',
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: useExistingBuild
          ? 'pnpm preview --host 127.0.0.1'
          : 'VITE_GOOGLE_FONTS_API_KEY=playwright-google-fonts-key pnpm build && pnpm preview --host 127.0.0.1',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: true,
      },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile',
      use: { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } },
    },
  ],
});
