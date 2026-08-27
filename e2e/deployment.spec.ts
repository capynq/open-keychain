import { expect, test } from '@playwright/test';
import { waitForImageToLoad, waitForReadyGeometry, watchBrowserErrors } from './helpers';

const activeHeroImageSelector =
  '.configurator-carousel-slide[data-showcase-kind="configurator"][data-active="true"] img';

test('generates and exports through the deployed nginx image', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Open Keychain' })).toBeVisible();
  await expect(page.locator('.landing-button-primary')).toBeVisible();
  await page.goto('/create');
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 15_000 });

  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose an export' });
  await expect(dialog).toBeVisible();

  const stlDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /STL file/ }).click();
  expect((await stlDownload).suggestedFilename()).toMatch(/\.stl$/);
  await dialog.getByLabel('Close').click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Export' }).click();
  await expect(dialog).toBeVisible();
  const threeMfDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /3MF · merged object/ }).click();
  expect((await threeMfDownload).suggestedFilename()).toMatch(/\.3mf$/);
});

test('loads responsive landing visuals and metadata in production', async ({ page }, testInfo) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.goto('/');
  await expect(page.locator('.landing-template-card img')).toHaveCount(4);
  await Promise.all([
    ...Array.from({ length: 4 }, (_, index) =>
      waitForImageToLoad(page.locator('.landing-template-card img').nth(index)),
    ),
    waitForImageToLoad(page.locator(activeHeroImageSelector)),
  ]);

  const templateSources = await page
    .locator('.landing-template-card img')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLImageElement).currentSrc));
  expect(templateSources.every((source) => source.includes('/showcase/templates/'))).toBe(true);
  const expectedHero =
    testInfo.project.name === 'deployed-mobile' ? 'create-mobile@2x.png' : 'create-desktop.png';
  const heroSource = await page
    .locator(activeHeroImageSelector)
    .evaluate((element) => (element as HTMLImageElement).currentSrc);
  expect(heroSource).toContain(expectedHero);

  const robots = await page.request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain('Sitemap: https://open-keychain.com/sitemap.xml');
  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain('<loc>https://open-keychain.com/</loc>');
  const privacy = await page.request.get('/privacy.html');
  expect(privacy.ok()).toBe(true);
  assertNoBrowserErrors();
});

test('keeps analytics gated by consent in production', async ({ page }) => {
  const analyticsRequests: string[] = [];
  page.on('request', (request) => {
    try {
      const hostname = new URL(request.url()).hostname;
      if (hostname === 'i.posthog.com' || hostname.endsWith('.i.posthog.com'))
        analyticsRequests.push(request.url());
    } catch {
      // Ignore malformed request URLs; Playwright should provide absolute URLs here.
    }
  });

  await page.goto('/');
  await page.waitForTimeout(500);
  expect(analyticsRequests).toEqual([]);
  await page.getByRole('button', { name: 'Allow analytics' }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('open-keychain.analytics-consent')))
    .toBe('accepted');
});

test('returns a real 404 for unknown production paths', async ({ page }) => {
  const response = await page.request.get('/seo-route-that-does-not-exist');
  expect(response.status()).toBe(404);
  expect(await response.text()).toContain('Page not found');
});

test('keeps all supported languages and customizer readiness in production', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.goto('/');
  const languagePicker = page.locator('.language-picker select');
  for (const locale of ['en', 'ru', 'uk']) {
    await languagePicker.selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
  }
  await page.goto('/create');
  await waitForReadyGeometry(page);
  assertNoBrowserErrors();
});
