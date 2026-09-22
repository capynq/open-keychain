import { expect, test } from '@playwright/test';

import { waitForReadyGeometry } from './helpers';

const activeHeroImageSelector =
  '.configurator-carousel-slide[data-showcase-kind="configurator"][data-active="true"] img';

test('reaches the first ready customizer preview within the startup budget', async ({ page }) => {
  const startedAt = performance.now();
  await page.goto('/create');
  await waitForReadyGeometry(page);
  const elapsedMs = performance.now() - startedAt;
  const budget = test.info().project.name === 'mobile' ? 5_000 : 3_000;
  expect(elapsedMs, `first ready preview took ${elapsedMs.toFixed(0)} ms`).toBeLessThan(budget);
});

test('selects modern landing images while preserving lazy PNG fallbacks', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.goto('/');
  const hero = page.locator(activeHeroImageSelector);
  await expect(hero).toHaveJSProperty('complete', true);
  await expect(hero).toHaveAttribute('src', '/showcase/create-desktop.png');
  await expect(hero).toHaveAttribute('loading', 'eager');
  await expect(hero).toHaveAttribute('fetchpriority', 'high');
  await expect
    .poll(() => hero.evaluate((element) => (element as HTMLImageElement).currentSrc))
    .toContain('/showcase/v1/');

  const templateImages = page.locator('.landing-template-card img');
  await expect(templateImages).toHaveCount(4);
  await expect(templateImages.first()).toHaveAttribute('loading', 'lazy');
  await expect(templateImages.first()).toHaveAttribute('decoding', 'async');
  await expect(page.locator('[data-showcase-kind="photo"] img').first()).toHaveAttribute(
    'loading',
    'lazy',
  );
  await expect(page.locator('[data-showcase-kind="photo"] img').first()).toHaveAttribute(
    'decoding',
    'async',
  );
  expect(requests.some((url) => url.endsWith('/showcase/create-desktop.png'))).toBe(false);
});

if (process.env.PLAYWRIGHT_PERFORMANCE === 'true') {
  test('keeps the preview render loop idle when the model is unchanged', async ({ page }) => {
    await page.addInitScript(() => {
      const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
      let callbackCount = 0;

      window.requestAnimationFrame = (callback) => {
        callbackCount += 1;
        return originalRequestAnimationFrame(callback);
      };
      Object.defineProperty(window, '__previewRafCount', {
        configurable: true,
        get: () => callbackCount,
      });
    });

    await page.goto('/create');
    await waitForReadyGeometry(page);

    const idleRafCount = await page.evaluate(async () => {
      const before = Number(
        (window as typeof window & { __previewRafCount: number }).__previewRafCount,
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      return (
        Number((window as typeof window & { __previewRafCount: number }).__previewRafCount) - before
      );
    });

    expect(idleRafCount, `idle preview scheduled ${idleRafCount} animation frames`).toBeLessThan(8);
  });
}
