import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Worker as PlaywrightWorker,
} from '@playwright/test';
import { writeFile } from 'node:fs/promises';

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

const collectResources = () =>
  (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map(
    ({ name, startTime, responseEnd, transferSize, encodedBodySize }) => ({
      name,
      startTime,
      responseEnd,
      transferSize,
      encodedBodySize,
    }),
  );

test('fetches the geometry worker chunk and WASM once, before the app chunk finishes', async ({
  page,
}) => {
  test.skip(page.context().browser()?.browserType().name() !== 'chromium', 'CDP is Chromium-only');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  const isWasm = (url: string) => url.endsWith('/manifold-v1.wasm');
  const isWorkerChunk = (url: string) => /\/assets\/geometry-worker-[^/]+\.js$/.test(url);
  const cached = new Set<string>();
  const pageRequests: { url: string; initiator: string; requestId: string }[] = [];
  cdp.on(
    'Network.requestWillBeSent',
    (event: { requestId: string; request: { url: string }; initiator: { type: string } }) => {
      if (isWasm(event.request.url) || isWorkerChunk(event.request.url))
        pageRequests.push({
          url: event.request.url,
          initiator: event.initiator.type,
          requestId: event.requestId,
        });
    },
  );
  cdp.on('Network.requestServedFromCache', (event: { requestId: string }) =>
    cached.add(event.requestId),
  );
  cdp.on(
    'Network.responseReceived',
    (event: {
      requestId: string;
      response: { fromDiskCache?: boolean; fromMemoryCache?: boolean; fromPrefetchCache?: boolean };
    }) => {
      const { response } = event;
      if (response.fromDiskCache || response.fromMemoryCache || response.fromPrefetchCache)
        cached.add(event.requestId);
    },
  );

  const workers: PlaywrightWorker[] = [];
  page.on('worker', (worker) => workers.push(worker));

  await page.goto('/create');
  await waitForReadyGeometry(page);

  const pageEntries = await page.evaluate(collectResources);
  const workerEntries = (
    await Promise.all(workers.map((worker) => worker.evaluate(collectResources)))
  ).flat();
  const appChunk = pageEntries.find((entry) => /\/assets\/app-[^/]+\.js$/.test(entry.name));
  const wasm = pageEntries.filter((entry) => entry.name.endsWith('/manifold-v1.wasm'));
  const workerChunk = pageEntries.filter((entry) =>
    /\/assets\/geometry-worker-[^/]+\.js$/.test(entry.name),
  );
  const downloads = (entries: { transferSize: number; encodedBodySize: number }[]) =>
    entries.filter((entry) => entry.transferSize >= entry.encodedBodySize).length;

  expect(appChunk).toBeDefined();
  expect(
    pageRequests.filter((request) => isWasm(request.url) && !cached.has(request.requestId)),
  ).toHaveLength(1);
  expect(
    pageRequests.filter(
      (request) =>
        isWorkerChunk(request.url) &&
        request.initiator !== 'other' &&
        !cached.has(request.requestId),
    ),
  ).toHaveLength(1);
  expect(
    downloads([
      ...wasm,
      ...workerEntries.filter((entry) => entry.name.endsWith('/manifold-v1.wasm')),
    ]),
  ).toBe(1);
  expect(downloads(workerChunk)).toBe(1);
  expect(wasm[0]?.startTime).toBeLessThan(appChunk!.responseEnd);
  expect(workerChunk[0]?.startTime).toBeLessThan(appChunk!.responseEnd);
});

const isEngineResource = (name: string) =>
  /manifold-v1\.wasm$|geometry-worker-[^/]+\.js$/.test(name);

const readAbsoluteResources = () =>
  (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map(
    ({ name, startTime }) => ({ name, startAt: performance.timeOrigin + startTime }),
  );

const readEngineRequests = async (page: Page, workers: PlaywrightWorker[]) => {
  const pageResources = await page.evaluate(readAbsoluteResources);
  const workerResources = (
    await Promise.all(workers.map((worker) => worker.evaluate(readAbsoluteResources)))
  ).flat();
  return {
    wasm: [...pageResources, ...workerResources].filter((entry) =>
      entry.name.endsWith('/manifold-v1.wasm'),
    ),
    workerChunk: pageResources.filter((entry) =>
      /\/assets\/geometry-worker-[^/]+\.js$/.test(entry.name),
    ),
  };
};

test('prewarms the geometry engine once after the landing load and idle, never before LCP', async ({
  page,
}) => {
  test.skip(
    page.context().browser()?.browserType().name() !== 'chromium',
    'largest-contentful-paint entries are Chromium-only',
  );
  await page.addInitScript(() => {
    const lcpStartTimes: number[] = [];
    Object.defineProperty(window, '__lcpStartTimes', { value: lcpStartTimes });
    new PerformanceObserver((list) =>
      lcpStartTimes.push(...list.getEntries().map((entry) => entry.startTime)),
    ).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const workers: PlaywrightWorker[] = [];
  page.on('worker', (worker) => workers.push(worker));

  await page.goto('/');
  await expect(
    page.getByRole('link', { name: 'Start designing', exact: true }).first(),
  ).toBeVisible();
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForFunction(
    () => (window as typeof window & { __lcpStartTimes: number[] }).__lcpStartTimes.length > 0,
    undefined,
    { timeout: 10_000 },
  );

  const landing = await page.evaluate(() => {
    const [navigation] = performance.getEntriesByType(
      'navigation',
    ) as PerformanceNavigationTiming[];
    const lcpStartTimes = (window as typeof window & { __lcpStartTimes: number[] }).__lcpStartTimes;
    return {
      loadEndAt: performance.timeOrigin + navigation!.loadEventEnd,
      lcpAt: performance.timeOrigin + lcpStartTimes[lcpStartTimes.length - 1]!,
      lcpEntries: lcpStartTimes.length,
    };
  });
  expect(landing.lcpEntries, 'no largest-contentful-paint entry was recorded').toBeGreaterThan(0);

  await expect
    .poll(async () => (await readEngineRequests(page, workers)).wasm.length, { timeout: 15_000 })
    .toBe(1);
  const requests = await readEngineRequests(page, workers);

  expect(requests.workerChunk).toHaveLength(1);
  for (const entry of [...requests.wasm, ...requests.workerChunk]) {
    expect(entry.startAt, `${entry.name} started before the landing load`).toBeGreaterThanOrEqual(
      landing.loadEndAt,
    );
    expect(entry.startAt, `${entry.name} started before LCP`).toBeGreaterThanOrEqual(landing.lcpAt);
  }
  await expect.poll(() => workers.length).toBe(1);
});

test('skips the geometry engine prewarm when data saver is requested', async ({ page }) => {
  test.skip(
    page.context().browser()?.browserType().name() !== 'chromium',
    'navigator.connection is only emulated in Chromium here',
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true, effectiveType: '4g' },
    });
  });
  const workers: PlaywrightWorker[] = [];
  page.on('worker', (worker) => workers.push(worker));

  await page.goto('/');
  await expect(
    page.getByRole('link', { name: 'Start designing', exact: true }).first(),
  ).toBeVisible();
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(4_500);

  const names = (await page.evaluate(collectResources)).map((entry) => entry.name);
  expect(names.filter(isEngineResource)).toEqual([]);
  expect(names.filter((name) => /\/assets\/geometry-client-pool-[^/]+\.js$/.test(name))).toEqual(
    [],
  );
  expect(workers).toHaveLength(0);
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
    .toContain('/showcase/v1/templates/magnet-');
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

  const waitForLandingReady = async (page: Page) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator(activeHeroImageSelector)).toHaveJSProperty('complete', true);
  };

  const declineAnalytics = (target: Page | BrowserContext) =>
    target.addInitScript(() => {
      localStorage.setItem('open-keychain.analytics-consent', 'declined');
    });

  const isChromium = (page: Page) => page.context().browser()?.browserType().name() === 'chromium';

  const throttleToSlowDevice = async (page: Page) => {
    const session = await page.context().newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 200_000,
      uploadThroughput: 93_750,
    });
  };

  type Rect = { x: number; y: number; width: number; height: number };
  type LayoutPaintProbe = {
    layoutShiftEntries: number;
    totalLayoutShift: number;
    cls: number;
    largestLayoutShifts: {
      value: number;
      startTime: number;
      sources: { node: string; previousRect: Rect; currentRect: Rect }[];
    }[];
    largestContentfulPaint: { startTime: number; element: string } | null;
    firstContentfulPaintMs: number | null;
    observerErrors: string[];
  };

  const installLayoutPaintProbe = () => {
    type ProbeRect = { x: number; y: number; width: number; height: number };
    const rect = (value: DOMRectReadOnly): ProbeRect => ({
      x: Math.round(value.x),
      y: Math.round(value.y),
      width: Math.round(value.width),
      height: Math.round(value.height),
    });
    const describe = (node: Node | null): string => {
      if (!(node instanceof Element)) return node?.nodeName ?? 'none';
      const className = node.getAttribute('class')?.split(/\s+/).find(Boolean);
      return `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${className ? `.${className}` : ''}`;
    };
    const probe: LayoutPaintProbe = {
      layoutShiftEntries: 0,
      totalLayoutShift: 0,
      cls: 0,
      largestLayoutShifts: [],
      largestContentfulPaint: null,
      firstContentfulPaintMs: null,
      observerErrors: [],
    };
    let sessionStart = -Infinity;
    let sessionEnd = -Infinity;
    let sessionValue = 0;
    Object.defineProperty(window, '__layoutPaintProbe', { configurable: true, value: probe });

    const observe = (type: string, callback: PerformanceObserverCallback) => {
      if (!PerformanceObserver.supportedEntryTypes?.includes(type)) {
        probe.observerErrors.push(`unsupported: ${type}`);
        return;
      }
      try {
        new PerformanceObserver(callback).observe({ type, buffered: true });
      } catch (error) {
        probe.observerErrors.push(`${type}: ${String(error)}`);
      }
    };

    observe('layout-shift', (list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
        sources: {
          node: Node | null;
          previousRect: DOMRectReadOnly;
          currentRect: DOMRectReadOnly;
        }[];
      })[]) {
        probe.layoutShiftEntries += 1;
        if (entry.hadRecentInput) continue;
        probe.totalLayoutShift += entry.value;
        if (entry.startTime - sessionEnd >= 1_000 || entry.startTime - sessionStart > 5_000) {
          sessionStart = entry.startTime;
          sessionValue = 0;
        }
        sessionEnd = entry.startTime;
        sessionValue += entry.value;
        probe.cls = Math.max(probe.cls, sessionValue);
        probe.largestLayoutShifts.push({
          value: entry.value,
          startTime: entry.startTime,
          sources: entry.sources.map((source) => ({
            node: describe(source.node),
            previousRect: rect(source.previousRect),
            currentRect: rect(source.currentRect),
          })),
        });
      }
      probe.largestLayoutShifts.sort((left, right) => right.value - left.value);
      probe.largestLayoutShifts.splice(10);
    });

    observe('largest-contentful-paint', (list) => {
      const entries = list.getEntries() as (PerformanceEntry & { element: Element | null })[];
      const latest = entries[entries.length - 1];
      if (latest)
        probe.largestContentfulPaint = {
          startTime: latest.startTime,
          element: describe(latest.element),
        };
    });

    observe('paint', (list) => {
      const entry = list
        .getEntries()
        .find((candidate) => candidate.name === 'first-contentful-paint');
      if (entry) probe.firstContentfulPaintMs = entry.startTime;
    });
  };

  type ProbeWindow = Window & { __layoutPaintProbe?: LayoutPaintProbe };

  const waitForQuietLayout = (page: Page) =>
    page.evaluate(
      () =>
        new Promise<{ waitedMs: number; quietMs: number; timedOut: boolean }>((resolve, reject) => {
          const probe = (window as ProbeWindow).__layoutPaintProbe;
          if (!probe) return reject(new Error('layout-paint probe was not installed'));
          const started = performance.now();
          let seen = probe.layoutShiftEntries;
          let quietSince = started;
          const tick = () => {
            const now = performance.now();
            if (probe.layoutShiftEntries !== seen) {
              seen = probe.layoutShiftEntries;
              quietSince = now;
            }
            const quietMs = now - quietSince;
            if (document.readyState === 'complete' && quietMs >= 500)
              return resolve({ waitedMs: now - started, quietMs, timedOut: false });
            if (now - started >= 5_000)
              return resolve({ waitedMs: now - started, quietMs, timedOut: true });
            setTimeout(tick, 50);
          };
          tick();
        }),
    );
  const readLayoutPaintProbe = async (page: Page, throttled: boolean) => {
    const readWindow = await waitForQuietLayout(page);
    const probe = await page.evaluate(() => {
      const installed = (window as ProbeWindow).__layoutPaintProbe;
      if (!installed) throw new Error('layout-paint probe was not installed');
      return installed;
    });
    return { throttled, readWindow, ...probe };
  };

  const layoutPaintRoutes = [
    { name: 'landing', path: '/', ready: waitForLandingReady },
    { name: 'create', path: '/create', ready: waitForReadyGeometry },
  ] as const;

  for (const route of layoutPaintRoutes) {
    for (const throttled of [false, true]) {
      const variant = throttled ? '.throttled' : '';
      test(`records layout shift, LCP and paint on ${route.name}${variant}`, async ({
        page,
      }, testInfo) => {
        test.setTimeout(120_000);
        test.skip(throttled && !isChromium(page), 'CPU and network throttling needs Chromium');
        await declineAnalytics(page);
        await page.addInitScript(installLayoutPaintProbe);
        if (throttled) await throttleToSlowDevice(page);
        await page.goto(route.path);
        await route.ready(page);
        const data = await readLayoutPaintProbe(page, throttled);
        await testInfo.attach(`layout-paint-${route.name}${variant}.json`, {
          body: JSON.stringify(data, null, 2),
          contentType: 'application/json',
        });
        expect(
          data.firstContentfulPaintMs,
          'first-contentful-paint was not observed',
        ).not.toBeNull();
      });
    }
  }

  const readPreviewGeometry = (target: Page) =>
    target.locator('.preview-panel').evaluateAll((elements) => {
      const element = elements[0];
      if (!element) return {};
      return Object.fromEntries(
        Array.from(element.attributes)
          .filter((attribute) => attribute.name.startsWith('data-geometry-'))
          .map((attribute) => [attribute.name, attribute.value]),
      );
    });

  const cacheFields = (geometry: Record<string, string>) => ({
    clientCacheHit: geometry['data-geometry-client-cache-hit'] ?? null,
    wasmWaitMs: geometry['data-geometry-wasm-wait-ms'] ?? null,
  });

  const pollThrottledReady = async (target: Page, budgetMs: number) => {
    const started = performance.now();
    const live = target.locator('main[aria-label="Customizer"]:not(.customizer-boot-frame)');
    const statusTimeline: { text: string | null; atMs: number }[] = [];
    let previous: string | null | undefined;
    let reachedReady = false;
    while (performance.now() - started < budgetMs) {
      const text = (await live.locator('.status-pill').allTextContents())[0]?.trim() ?? null;
      if (text !== previous) {
        statusTimeline.push({ text, atMs: Math.round(performance.now() - started) });
        previous = text;
      }
      if (
        text !== null &&
        /Ready/.test(text) &&
        (await live.locator('.viewer-surface canvas').isVisible())
      ) {
        reachedReady = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return {
      reachedReady,
      elapsedMs: Math.round(performance.now() - started),
      budgetMs,
      finalStatus: statusTimeline[statusTimeline.length - 1]?.text ?? null,
      statusTimeline,
      recoveryElements: await target
        .locator('[data-recovery-code], [data-recovery-notice]')
        .count(),
      recoveryCodes: await target
        .locator('[data-recovery-code]')
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('data-recovery-code')),
        ),
      geometry: await readPreviewGeometry(target),
    };
  };

  for (const throttled of [false, true]) {
    const variant = throttled ? '.throttled' : '';
    test(`records startup timings to the first ready preview${variant}`, async ({
      page,
      browser,
    }, testInfo) => {
      test.setTimeout(throttled ? 240_000 : 120_000);
      test.skip(throttled && !isChromium(page), 'CPU and network throttling needs Chromium');
      const testStartedAt = performance.now();
      await declineAnalytics(page);
      if (throttled) await throttleToSlowDevice(page);

      const { viewport, isMobile, hasTouch, deviceScaleFactor } = testInfo.project.use;
      const navContext = await browser.newContext({
        viewport,
        isMobile,
        hasTouch,
        deviceScaleFactor,
        locale: 'en-US',
        timezoneId: 'UTC',
        colorScheme: 'light',
      });
      try {
        await declineAnalytics(navContext);
        const navPage = await navContext.newPage();
        if (throttled) await throttleToSlowDevice(navPage);

        const outOfBudget = () => throttled && testStartedAt + 200_000 - performance.now() <= 0;
        const awaitPreview = async (target: Page) => {
          if (!throttled) {
            await waitForReadyGeometry(target);
            return null;
          }
          const budgetMs = Math.min(100_000, testStartedAt + 200_000 - performance.now());
          return pollThrottledReady(target, budgetMs);
        };

        const ctaRun = async () => {
          if (outOfBudget()) return { skipped: true };
          const startedAt = performance.now();
          await page.goto('/');
          await waitForLandingReady(page);
          const landingReadyMs = performance.now() - startedAt;
          await page.getByRole('link', { name: 'Start designing', exact: true }).first().click();
          const ctaClickedAt = performance.now();
          const readiness = await awaitPreview(page);
          const ctaToReadyPreviewMs = performance.now() - ctaClickedAt;
          return {
            landingReadyMs,
            ctaToReadyPreviewMs,
            ...cacheFields(await readPreviewGeometry(page)),
            ...(readiness ? { readiness } : {}),
          };
        };

        const directRun = async (navigate: () => Promise<unknown>) => {
          if (outOfBudget()) return { skipped: true };
          const startedAt = performance.now();
          await navigate();
          const readiness = await awaitPreview(navPage);
          const navigationToReadyPreviewMs = performance.now() - startedAt;
          return {
            navigationToReadyPreviewMs,
            ...cacheFields(await readPreviewGeometry(navPage)),
            ...(readiness ? { readiness } : {}),
          };
        };

        const ctaCold = await ctaRun();
        const ctaColdGeometry = await readPreviewGeometry(page);
        const ctaReload = await ctaRun();
        const directCold = await directRun(() => navPage.goto('/create'));
        const directColdGeometry = await readPreviewGeometry(navPage);
        const directReload = await directRun(() => navPage.reload());

        const body = JSON.stringify(
          {
            throttled,
            cta: {
              cold: { ...ctaCold, geometry: ctaColdGeometry },
              reload: ctaReload,
            },
            direct: {
              cold: { ...directCold, geometry: directColdGeometry },
              reload: directReload,
            },
          },
          null,
          2,
        );
        const name = `startup-cold-warm${variant}.json`;
        await writeFile(testInfo.outputPath(name), body);
        await testInfo.attach(name, { body, contentType: 'application/json' });
      } finally {
        await navContext.close();
      }
    });
  }

  type ShiftRecord = {
    value: number;
    startTime: number;
    sources: { node: string; previousRect: Rect; currentRect: Rect }[];
  };

  const installShiftLog = () => {
    type ProbeRect = { x: number; y: number; width: number; height: number };
    const rect = (value: DOMRectReadOnly): ProbeRect => ({
      x: Math.round(value.x),
      y: Math.round(value.y),
      width: Math.round(value.width),
      height: Math.round(value.height),
    });
    const describe = (node: Node | null): string => {
      if (!(node instanceof Element)) return node?.nodeName ?? 'none';
      const className = node.getAttribute('class')?.split(/\s+/).find(Boolean);
      return `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${className ? `.${className}` : ''}`;
    };
    const probe = { layoutShiftEntries: 0, shiftLog: [] as ShiftRecord[] };
    Object.defineProperty(window, '__layoutPaintProbe', { configurable: true, value: probe });
    if (!PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) return;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources: {
            node: Node | null;
            previousRect: DOMRectReadOnly;
            currentRect: DOMRectReadOnly;
          }[];
        })[]) {
          probe.layoutShiftEntries += 1;
          if (entry.hadRecentInput) continue;
          probe.shiftLog.push({
            value: entry.value,
            startTime: entry.startTime,
            sources: entry.sources.map((source) => ({
              node: describe(source.node),
              previousRect: rect(source.previousRect),
              currentRect: rect(source.currentRect),
            })),
          });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      probe.layoutShiftEntries = -1;
    }
  };

  const sessionWindowCls = (shifts: ShiftRecord[]) => {
    let best = 0;
    let current = 0;
    let sessionStart = -Infinity;
    let last = -Infinity;
    for (const shift of shifts) {
      if (shift.startTime - last >= 1_000 || shift.startTime - sessionStart > 5_000) {
        sessionStart = shift.startTime;
        current = 0;
      }
      last = shift.startTime;
      current += shift.value;
      best = Math.max(best, current);
    }
    return best;
  };

  for (const throttled of [false, true]) {
    const variant = throttled ? '.throttled' : '';
    test(`records layout shift across landing → setup navigation${variant}`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(240_000);
      test.skip(throttled && !isChromium(page), 'CPU and network throttling needs Chromium');
      await declineAnalytics(page);
      await page.addInitScript(installShiftLog);
      if (throttled) await throttleToSlowDevice(page);

      const marks: { name: string; at: number }[] = [];
      const mark = async (name: string) => {
        marks.push({ name, at: await page.evaluate(() => performance.now()) });
      };

      await page.goto('/');
      await waitForLandingReady(page);
      await mark('tap');
      const cta = page.getByRole('link', { name: 'Start designing', exact: true }).first();
      if (testInfo.project.use.hasTouch) await cta.tap();
      else await cta.click();

      const setup = page.getByTestId('quick-setup-dialog');
      await expect(setup).toBeVisible();
      if (throttled) await pollThrottledReady(page, 100_000);
      else await waitForReadyGeometry(page);
      await mark('setup-open');

      await setup.getByLabel('Name or text').fill('OLIVER');
      await setup.getByLabel(/80 × 30/).check();
      await setup.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(
        setup.getByRole('heading', { name: 'Keyring hole position', exact: true }),
      ).toBeVisible();
      await mark('step-2');

      await setup.getByRole('radio', { name: 'Top', exact: true }).check();
      await setup.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(
        setup.getByRole('heading', { name: 'Keyring opening shape and size', exact: true }),
      ).toBeVisible();
      await mark('after-setup');

      await setup.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(setup).toBeHidden();
      const readWindow = await waitForQuietLayout(page);
      await mark('read');

      const shifts = await page.evaluate(() => {
        const installed = (window as Window & { __layoutPaintProbe?: { shiftLog: ShiftRecord[] } })
          .__layoutPaintProbe;
        if (!installed) throw new Error('shift log probe was not installed');
        return installed.shiftLog;
      });
      const at = new Map(marks.map((entry) => [entry.name, entry.at]));
      const phases = [
        { name: 'landing', start: 0, end: at.get('tap') ?? 0 },
        { name: 'navigation-boot', start: at.get('tap') ?? 0, end: at.get('setup-open') ?? 0 },
        { name: 'setup-step-1', start: at.get('setup-open') ?? 0, end: at.get('step-2') ?? 0 },
        { name: 'setup-step-2', start: at.get('step-2') ?? 0, end: at.get('after-setup') ?? 0 },
        { name: 'after-setup', start: at.get('after-setup') ?? 0, end: at.get('read') ?? 0 },
      ];
      const phaseOf = (startTime: number) =>
        phases.find((phase) => startTime >= phase.start && startTime < phase.end)?.name ??
        'outside-phases';

      const body = JSON.stringify(
        {
          throttled,
          project: testInfo.project.name,
          readWindow,
          totalLayoutShift: shifts.reduce((sum, shift) => sum + shift.value, 0),
          cls: sessionWindowCls(shifts),
          phases: phases.map((phase) => {
            const inPhase = shifts.filter((shift) => phaseOf(shift.startTime) === phase.name);
            return {
              name: phase.name,
              startMs: Math.round(phase.start),
              endMs: Math.round(phase.end),
              shiftSum: inPhase.reduce((sum, shift) => sum + shift.value, 0),
              entries: inPhase.length,
            };
          }),
          topShifts: [...shifts]
            .sort((left, right) => right.value - left.value)
            .slice(0, 10)
            .map((shift) => ({ ...shift, phase: phaseOf(shift.startTime) })),
          marks,
        },
        null,
        2,
      );
      const name = `layout-shift-landing-setup${variant}.json`;
      await writeFile(testInfo.outputPath(name), body);
      await testInfo.attach(name, { body, contentType: 'application/json' });
    });
  }
}
