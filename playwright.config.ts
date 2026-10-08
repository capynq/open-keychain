import { defineConfig } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const previewPort = Number(process.env.PLAYWRIGHT_PREVIEW_PORT ?? 4173);
if (!Number.isInteger(previewPort) || previewPort < 1 || previewPort > 65_535)
  throw new Error('PLAYWRIGHT_PREVIEW_PORT must be an integer from 1 to 65535.');
const previewUrl = `http://127.0.0.1:${previewPort}`;
const useExistingBuild = process.env.PLAYWRIGHT_USE_EXISTING_BUILD === 'true';
const smokeRun = process.env.PLAYWRIGHT_SMOKE === 'true';
const deploymentRun = process.env.PLAYWRIGHT_DEPLOYMENT === 'true';
const hostedRun = process.env.VITE_HOSTED_MODE === 'true';
const ignoredSpecs = smokeRun
  ? [/(deployment|capture|dev-boot)\.spec\.ts/]
  : deploymentRun
    ? [/(capture|smoke|dev-boot)\.spec\.ts/]
    : [/(deployment|capture|smoke|dev-boot)\.spec\.ts/];

export default defineConfig({
  reporter: [['list'], ['./scripts/validation/reporters/validation-playwright-reporter.mjs']],
  testDir: './e2e',
  testIgnore: hostedRun ? ignoredSpecs : [...ignoredSpecs, /workspace\.spec\.ts/],
  timeout: 30_000,
  use: {
    baseURL: externalBaseUrl ?? previewUrl,
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
          ? `pnpm preview --host 127.0.0.1 --port ${previewPort}`
          : `VITE_GOOGLE_FONTS_API_KEY=playwright-google-fonts-key pnpm build && pnpm preview --host 127.0.0.1 --port ${previewPort}`,
        url: previewUrl,
        // Validation must serve the artifact built for this exact checkout.
        reuseExistingServer: false,
      },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile',
      use: { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } },
    },
    {
      name: 'mobile-2x',
      use: {
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
