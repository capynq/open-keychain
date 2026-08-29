import { expect, test } from '@playwright/test';
import { waitForReadyGeometry } from './helpers';

test('reaches the first ready customizer preview within the startup budget', async ({ page }) => {
  const startedAt = performance.now();
  await page.goto('/create');
  await waitForReadyGeometry(page);
  const elapsedMs = performance.now() - startedAt;
  const budget = test.info().project.name === 'mobile' ? 5_000 : 3_000;
  expect(elapsedMs, `first ready preview took ${elapsedMs.toFixed(0)} ms`).toBeLessThan(budget);
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
