import { expect, test } from '@playwright/test';

import {
  selectLocale,
  waitForImageToLoad,
  waitForReadyGeometry,
  watchBrowserErrors,
} from './helpers';

const activeHeroImageSelector =
  '.configurator-carousel-slide[data-showcase-kind="configurator"][data-active="true"] img';

test('generates and exports through the production static site', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Open Keychain' })).toBeVisible();
  await page.goto('/create');
  await expect(page.locator('.status-pill')).toHaveText(/Ready/, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose an export' });
  await expect(dialog).toBeVisible();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /STL file/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.stl$/);
});

test('loads static metadata and privacy page in production', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.goto('/');
  await expect(page.locator('.landing-template-card img')).toHaveCount(4);
  await page.locator('.landing-template-card').last().scrollIntoViewIfNeeded();
  await Promise.all([
    ...Array.from({ length: 4 }, (_, index) =>
      waitForImageToLoad(page.locator('.landing-template-card img').nth(index)),
    ),
    waitForImageToLoad(page.locator(activeHeroImageSelector)),
  ]);
  const robots = await page.request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain('Sitemap: https://open-keychain.com/sitemap.xml');
  expect(await robots.text()).not.toContain('LLMs:');
  expect((await page.request.get('/sitemap.xml')).ok()).toBe(true);
  expect((await page.request.get('/llms.txt')).ok()).toBe(true);
  const aiCatalog = await page.request.get('/ai-catalog.json');
  expect(aiCatalog.ok()).toBe(true);
  expect(aiCatalog.headers()['content-type']).toContain('application/json');
  expect(await aiCatalog.json()).toMatchObject({
    specVersion: '1.0',
    entries: [
      {
        url: 'https://open-keychain.com/create',
      },
    ],
  });
  const rootHeaders = (await page.request.get('/')).headers();
  expect(rootHeaders.link).toContain('rel="preload"');
  const versionedAsset = await page.request.get('/showcase/v1/create-mobile-490.avif');
  expect(versionedAsset.headers()['cache-control']).toContain('max-age=31536000');
  expect(versionedAsset.headers()['cache-control']).toContain('immutable');
  const legacyAsset = await page.request.get('/showcase/create-mobile.png');
  expect(legacyAsset.headers()['cache-control']).toContain('max-age=86400');
  expect((await page.request.get('/privacy')).ok()).toBe(true);
  assertNoBrowserErrors();
});

test('uses the SPA fallback for unknown production paths', async ({ page }) => {
  await page.goto('/seo-route-that-does-not-exist');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('keeps all supported languages and customizer readiness in production', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.goto('/');
  for (const locale of ['en', 'ru', 'uk'] as const) {
    await selectLocale(page, locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
  }
  await page.goto('/create');
  await waitForReadyGeometry(page);
  assertNoBrowserErrors();
});
