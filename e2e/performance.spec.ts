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

test('selects modern landing images while preserving lazy PNG fallbacks', async ({
  page,
}, testInfo) => {
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
  const expectedHeroAsset =
    testInfo.project.name === 'mobile-2x'
      ? 'create-mobile-780'
      : testInfo.project.name === 'mobile'
        ? 'create-mobile-390'
        : 'create-desktop-720';
  await expect
    .poll(() => hero.evaluate((element) => (element as HTMLImageElement).currentSrc))
    .toContain(expectedHeroAsset);

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
  await expect(hero).toHaveAttribute('sizes', '(max-width: 760px) calc(100vw - 50px), 50vw');
  await expect(page.locator('.configurator-window source').first()).toHaveAttribute(
    'media',
    '(max-width: 760px) and (min-resolution: 2dppx)',
  );
  await expect(page.locator('.configurator-window source').nth(1)).toHaveAttribute(
    'srcset',
    /create-mobile-390\.avif 390w, \/showcase\/v1\/create-mobile-490\.avif 490w/,
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

  test('records candidate-to-render timing for repeated range edits', async ({
    page,
  }, testInfo) => {
    await page.goto('/create');
    await waitForReadyGeometry(page);

    const preview = page.locator('.preview-panel[data-model-ready="true"]');
    const textSize = page
      .getByTestId('adjustment-settings')
      .locator('[data-candidate-key="textSizeMm"]');
    const samples: {
      inputToRenderedMs: number;
      workerComputeMs?: number;
      workerCacheLookupMs?: number;
      meshSetupMs?: number;
      drawSubmitMs?: number;
    }[] = [];
    let generationId = await preview.getAttribute('data-generation-id');

    await textSize.focus();
    for (let index = 0; index < 5; index += 1) {
      const startedAt = await page.evaluate(() => performance.now());

      await textSize.press(index % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
      await expect.poll(() => preview.getAttribute('data-generation-id')).not.toBe(generationId);
      generationId = await preview.getAttribute('data-generation-id');
      await expect(preview).toHaveAttribute('data-rendered-generation-id', generationId ?? '');

      const sample = await page.evaluate((started) => {
        const element = document.querySelector('.preview-panel[data-model-ready="true"]');
        if (!element) throw new Error('Preview panel is missing.');
        const metric = (name: string): number | undefined => {
          const value = element.getAttribute(name);
          return value === null || value === '' ? undefined : Number(value);
        };
        return {
          inputToRenderedMs: performance.now() - started,
          workerComputeMs: metric('data-geometry-worker-compute-ms'),
          workerCacheLookupMs: metric('data-geometry-cache-lookup-ms'),
          meshSetupMs: metric('data-viewer-mesh-setup-ms'),
          drawSubmitMs: metric('data-viewer-draw-submit-ms'),
        };
      }, startedAt);

      samples.push(sample);
    }

    const sortedTotals = samples.map((sample) => sample.inputToRenderedMs).sort((a, b) => a - b);
    const percentile = (fraction: number): number =>
      sortedTotals[
        Math.min(sortedTotals.length - 1, Math.ceil(fraction * sortedTotals.length) - 1)
      ];

    await testInfo.attach('customizer-model-change-timings.json', {
      body: JSON.stringify(
        {
          samples,
          medianInputToRenderedMs: percentile(0.5),
          p95InputToRenderedMs: percentile(0.95),
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    expect(samples).toHaveLength(5);
    expect(samples.every((sample) => sample.meshSetupMs !== undefined)).toBe(true);
    expect(samples.every((sample) => sample.drawSubmitMs !== undefined)).toBe(true);
  });
}
