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
