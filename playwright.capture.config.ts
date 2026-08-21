import { defineConfig } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: /capture\.spec\.ts/,
  timeout: 45_000,
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4173',
    browserName: 'chromium',
    colorScheme: 'light',
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    launchOptions: {
      args: [
        '--use-angle=swiftshader',
        '--use-gl=angle',
        '--enable-webgl',
        '--force-color-profile=srgb',
      ],
    },
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'pnpm preview --host 127.0.0.1',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: true,
      },
  projects: [
    { name: 'capture-desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'capture-mobile',
      use: { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } },
    },
    {
      name: 'capture-mobile-2x',
      use: {
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
