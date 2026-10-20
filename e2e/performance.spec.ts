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
  await expect(templateImages).toHaveCount(5);
  await expect(templateImages.first()).toHaveAttribute('loading', 'lazy');
  await expect(templateImages.first()).toHaveAttribute('decoding', 'async');
  await templateImages.last().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      templateImages.last().evaluate((element) => (element as HTMLImageElement).currentSrc),
    )
    .toContain('/showcase/templates/magnet.png');
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

  for (const scenario of ['range', 'discrete', 'text'] as const) {
    test(`records candidate-to-render timing for repeated ${scenario} edits`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(60_000);
      await page.goto('/create');
      await waitForReadyGeometry(page);
      await page.getByTestId('editor-mode').getByText('Pro', { exact: true }).click();
      const preview = page.locator('.preview-panel[data-model-ready="true"]');
      const textSize = page
        .getByTestId('adjustment-settings')
        .locator('[data-candidate-key="textSizeMm"]');
      if (scenario === 'range') await textSize.focus();
      const samples: Record<string, number | undefined>[] = [];
      let generationId = await preview.getAttribute('data-generation-id');
      for (let index = 0; index < 32; index += 1) {
        if (scenario === 'range')
          await textSize.press(index % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
        else if (scenario === 'discrete')
          await page
            .getByRole('button', { name: index % 2 === 0 ? 'Capsule' : 'Contour', exact: true })
            .click();
        else
          await page
            .getByLabel('Name or text', { exact: true })
            .fill(index % 2 === 0 ? 'ALEXA' : 'ALEX');
        await expect.poll(() => preview.getAttribute('data-generation-id')).not.toBe(generationId);
        generationId = await preview.getAttribute('data-generation-id');
        await expect(preview).toHaveAttribute('data-rendered-generation-id', generationId ?? '');
        const sample = await preview.evaluate((element) => {
          const metric = (name: string): number | undefined => {
            const value = element.getAttribute(name);
            return value === null || value === '' ? undefined : Number(value);
          };
          return {
            inputToRenderedMs: metric('data-candidate-to-ready-ms'),
            inputToDrawSubmittedMs: metric('data-candidate-to-render-ms'),
            inputAt: metric('data-candidate-input-at'),
            dispatchedAt: metric('data-candidate-dispatched-at'),
            validatedAt: metric('data-candidate-validated-at'),
            acceptedAt: metric('data-candidate-accepted-at'),
            drawSubmittedAt: metric('data-preview-rendered-at'),
            renderedAt: metric('data-preview-ready-committed-at'),
            clientCacheHit: metric('data-geometry-client-cache-hit'),
            workerCacheHit: metric('data-geometry-worker-cache-hit'),
            clientQueueMs: metric('data-geometry-client-queue-ms'),
            workerComputeMs: metric('data-geometry-worker-compute-ms'),
            meshSetupMs: metric('data-viewer-mesh-setup-ms'),
            drawSubmitMs: metric('data-viewer-draw-submit-ms'),
          };
        });
        expect(sample.inputToRenderedMs).toBeGreaterThanOrEqual(0);
        expect(sample.dispatchedAt!).toBeGreaterThanOrEqual(sample.inputAt!);
        expect(sample.acceptedAt!).toBeGreaterThanOrEqual(sample.validatedAt!);
        expect(sample.drawSubmittedAt!).toBeGreaterThanOrEqual(sample.acceptedAt!);
        expect(sample.renderedAt!).toBeGreaterThanOrEqual(sample.drawSubmittedAt!);
        if (sample.clientCacheHit === 1) expect(sample.workerComputeMs).toBeUndefined();
        samples.push(sample);
      }
      const warmSamples = samples.slice(2);
      const sorted = warmSamples.map((sample) => sample.inputToRenderedMs!).sort((a, b) => a - b);
      await testInfo.attach('customizer-model-change-timings.json', {
        body: JSON.stringify(
          {
            scenario,
            coldSamples: samples.slice(0, 2),
            samples: warmSamples,
            medianInputToRenderedMs: sorted[14],
            p95InputToRenderedMs: sorted[28],
          },
          null,
          2,
        ),
        contentType: 'application/json',
      });
      expect(warmSamples).toHaveLength(30);
      expect(
        warmSamples.every(
          (sample) => sample.meshSetupMs !== undefined && sample.drawSubmitMs !== undefined,
        ),
      ).toBe(true);
    });
  }

  test('renders the final value after a rapid continuous edit burst', async ({ page }) => {
    await page.goto('/create');
    await waitForReadyGeometry(page);
    await page.getByTestId('editor-mode').getByText('Pro', { exact: true }).click();
    const preview = page.locator('.preview-panel');
    const previous = await preview.getAttribute('data-generation-id');
    const slider = page
      .getByTestId('adjustment-settings')
      .locator('[data-candidate-key="textSizeMm"]');
    const final = await slider.evaluate((element) => {
      const input = element as HTMLInputElement;
      const initial = Number(input.value);
      const step = Number(input.step);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      for (let index = 1; index <= 12; index += 1) {
        setter.call(input, String(initial + index * step));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return input.value;
    });
    await expect.poll(() => preview.getAttribute('data-generation-id')).not.toBe(previous);
    await waitForReadyGeometry(page);
    await expect(slider).toHaveValue(final);
    await expect(page.locator('.candidate-feedback-rejected')).toHaveCount(0);
    const generation = await preview.getAttribute('data-generation-id');
    await expect(preview).toHaveAttribute('data-rendered-generation-id', generation!);
  });
}
