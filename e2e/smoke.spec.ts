import { expect, test } from '@playwright/test';
import { waitForImageToLoad, waitForReadyGeometry, watchBrowserErrors } from './helpers';

const carousel = '.configurator-carousel';
const activeSlide = '[data-showcase-slide][data-active="true"]';

const waitForSlide = async (page: Parameters<typeof watchBrowserErrors>[0], id: string) => {
  await expect(page.locator(`[data-showcase-slide="${id}"][data-active="true"]`)).toBeVisible();
  await expect(page.locator(carousel)).toHaveAttribute('data-moving', 'false');
};

test('loads the landing hero, reviewed visuals, and carousel without layout errors', async ({
  page,
}) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-showcase-slide]')).toHaveCount(3);
  await expect(page.locator('.landing-template-card img')).toHaveCount(4);
  await Promise.all([
    ...Array.from({ length: 4 }, (_, index) =>
      waitForImageToLoad(page.locator('.landing-template-card img').nth(index)),
    ),
    waitForImageToLoad(page.locator(`${activeSlide} img`)),
  ]);

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  assertNoBrowserErrors();
});

test('advances and wraps the carousel with its controls', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.goto('/');
  const next = page.locator('[data-showcase-control="next"]');

  await waitForSlide(page, 'configurator');
  await next.click();
  await waitForSlide(page, 'print-example-1');
  await next.click();
  await waitForSlide(page, 'print-example-2');
  await next.click();
  await waitForSlide(page, 'configurator');
  assertNoBrowserErrors();
});

test('reaches a ready customizer preview', async ({ page }) => {
  const assertNoBrowserErrors = watchBrowserErrors(page);
  await page.goto('/create');
  await waitForReadyGeometry(page);
  await expect(page.locator('.viewer-surface canvas')).toBeVisible();
  assertNoBrowserErrors();
});
