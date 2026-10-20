import { defineConfig } from '@playwright/test';

const previewPort = Number(process.env.PLAYWRIGHT_PREVIEW_PORT ?? 4174);
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const useExistingBuild = process.env.PLAYWRIGHT_USE_EXISTING_BUILD === 'true';
const previewUrl = `http://127.0.0.1:${previewPort}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: /preview-lifecycle\.spec\.ts/,
  timeout: 45_000,
  fullyParallel: false,
  use: {
    baseURL: externalBaseUrl ?? previewUrl,
    browserName: 'firefox',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: useExistingBuild
          ? `pnpm preview --host 127.0.0.1 --port ${previewPort}`
          : `VITE_GOOGLE_FONTS_API_KEY=playwright-google-fonts-key pnpm build && pnpm preview --host 127.0.0.1 --port ${previewPort}`,
        url: previewUrl,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
